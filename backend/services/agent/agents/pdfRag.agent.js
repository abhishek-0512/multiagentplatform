import fs from "fs"
import path from "path"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { vectorStore, getVectorStore } from "../config/vectorDb.js"
import { getModel } from "../config/llmModels.js"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
import { parseFileContent } from "../utils/fileParser.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { saveAgentContext } from "../utils/contextManager.js"
import redis from "../../../shared/redis/redis.js"

export const pdfRag = async (state) => {
    try {
        await checkAgentLimit(state.userId, "pdfRag")

        const conversationId = state.conversationId || "default_conv"
        const safeConvId = `conv_${conversationId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
        const convDocsKey = `conv_docs:${conversationId}`
        const ragAnalysisKey = `rag_analysis:${conversationId}`

        let hasNewFile = Boolean(state.file && state.file.path)
        let newlyIndexedDoc = null

        // 1. Process and Index New File if attached
        if (hasNewFile) {
            console.log(`[UPLOAD] received: ${state.file.originalname} (size: ${state.file.size} bytes)`)
            console.log(`[PROCESS] started: extracting content from ${state.file.originalname}`)

            // Extract content
            const { text, metadata } = await parseFileContent(state.file)
            console.log(`[EXTRACT] success: ${metadata.filename} (${text.length} chars)`)

            // Create Chunks
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            })

            const chunks = await splitter.splitText(text)
            console.log(`[CHUNK] success: ${chunks.length} chunks created for ${metadata.filename}`)

            const docs = chunks.map((chunk, idx) => ({
                pageContent: chunk,
                metadata: {
                    userId: state.userId || "anonymous",
                    conversationId,
                    filename: metadata.filename,
                    fileType: metadata.fileType,
                    chunkIndex: idx,
                    totalChunks: chunks.length
                }
            }))

            // Embed and Store Vectors in Qdrant with timeout
            try {
                console.log(`[EMBED] generation started for ${docs.length} chunks`)
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Qdrant index timeout")), 2500))
                await Promise.race([vectorStore(docs, safeConvId), timeoutPromise])
                console.log(`[VECTOR] stored in collection ${safeConvId}`)
            } catch (vErr) {
                console.warn(`[VECTOR] Qdrant indexing note:`, vErr.message)
            }

            // Save document metadata in Conversation Registry
            newlyIndexedDoc = {
                filename: metadata.filename,
                fileType: metadata.fileType,
                charCount: text.length,
                chunkCount: docs.length,
                fullText: text.length <= 15000 ? text : "",
                uploadedAt: Date.now()
            }

            let existingDocs = []
            try {
                const stored = await redis.get(convDocsKey)
                if (stored) existingDocs = JSON.parse(stored)
            } catch (e) {}

            const updatedDocs = [...existingDocs.filter(d => d.filename !== metadata.filename), newlyIndexedDoc]
            await redis.set(convDocsKey, JSON.stringify(updatedDocs), "EX", 86400) // 24h retention
        }

        // 2. Fetch Conversation Document Registry
        let convDocs = []
        try {
            const stored = await redis.get(convDocsKey)
            if (stored) convDocs = JSON.parse(stored)
        } catch (e) {}

        if (convDocs.length === 0 && !hasNewFile) {
            return {
                ...state,
                agent: "pdfRag",
                aiResponse: "⚠️ No uploaded documents were found in this conversation. Please attach a file (PDF, Word, Excel, CSV, or Text) to analyze it."
            }
        }

        const userQuery = state.prompt && state.prompt.trim().length > 0
            ? state.prompt.trim()
            : "Please provide a comprehensive summary and key takeaways from the uploaded document."

        console.log(`[RAG] query received: "${userQuery}" for conversation: ${conversationId}`)

        // 3. Retrieve Relevant Chunks / Document Context
        let relevantChunks = []
        let sources = []

        // If documents are short, include complete text directly for 100% recall
        const smallDocs = convDocs.filter(d => d.fullText && d.fullText.length > 0)
        if (smallDocs.length > 0) {
            smallDocs.forEach(d => {
                relevantChunks.push(`[Full Document Content of "${d.filename}" (${d.fileType})]:\n${d.fullText}`)
                sources.push({ title: d.filename, url: `#file-${encodeURIComponent(d.filename)}` })
            })
        }

        // Vector Retrieval for large documents or multi-chunk docs if full text not sufficient
        if (relevantChunks.length === 0 || convDocs.some(d => !d.fullText)) {
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Qdrant retrieval timeout")), 2500))
                const store = await Promise.race([getVectorStore(safeConvId), timeoutPromise])
                const searchResults = await store.similaritySearch(userQuery, 6)
                if (searchResults && searchResults.length > 0) {
                    searchResults.forEach((r, i) => {
                        const src = r.metadata?.filename || "Uploaded Document"
                        relevantChunks.push(`[Excerpt ${i + 1} from "${src}"]: \n${r.pageContent}`)
                        if (!sources.some(s => s.title === src)) {
                            sources.push({ title: src, url: `#file-${encodeURIComponent(src)}` })
                        }
                    })
                    console.log(`[RAG] retrieval success: ${searchResults.length} chunks retrieved from Qdrant`)
                }
            } catch (searchErr) {
                console.warn(`[RAG] Vector retrieval note:`, searchErr.message)
            }
        }

        if (relevantChunks.length === 0 && newlyIndexedDoc) {
            relevantChunks.push(`[Document Content of "${newlyIndexedDoc.filename}"]: \n${newlyIndexedDoc.fullText || "Document parsed and indexed."}`)
            sources.push({ title: newlyIndexedDoc.filename, url: `#file-${encodeURIComponent(newlyIndexedDoc.filename)}` })
        }

        const context = relevantChunks.join("\n\n---\n\n")
        console.log(`[LLM] context received: ${context.length} characters`)

        // 4. Invoke LLM with strict grounding and resilient fallback
        console.log(`[RAG] Generating answer with grounded LLM...`)

        const docNames = convDocs.map(d => `"${d.filename}"`).join(", ") || (hasNewFile ? `"${state.file.originalname}"` : "uploaded document")

        const messages = [
            new SystemMessage(
                `You are Nexora Document & Data Analyst.
You analyze user-uploaded files (${docNames}) and provide comprehensive, grounded, and accurate analysis.

GROUNDING RULES:
1. Ground your entire analysis STRICTLY on the provided document content.
2. EXTRACT AND HIGHLIGHT ALL KEY FACTS, SPECIFICATIONS, CONFIGURATIONS, ARCHITECTURES, AND DATA POINTS explicitly stated in the document (e.g., specific databases, caching tools like Redis, TTL configurations like 30 minutes, strategies like cache-aside, source of truth databases like PostgreSQL, metrics, ports, tables, row values).
3. Structure your response clearly:
   - **Executive Overview & Primary Topic**
   - **Key Architectural / Technical Specifications & Stated Facts** (list all specific tools, TTLs, strategies, databases, and numbers)
   - **Analysis & Evaluation** (strengths, workflow, or critique)
   - **Actionable Takeaways & Next Steps**
4. If this is a resume, evaluate summary, strengths, experience, ATS keywords, and areas to improve.
5. Format with clean Markdown headings, bullet points, and tables.`
            ),
            new HumanMessage(
                `DOCUMENT CONTEXT:\n${context}\n\nUSER INSTRUCTION:\n${userQuery}`
            )
        ]

        let response
        try {
            const llm = await getModel("pdfRag")
            response = await llm.invoke(messages)
        } catch (llmErr) {
            console.warn("[RAG] Primary LLM hit limit, using resilient fallback:", llmErr.message)
            const fallbackLlm = await getModel("chat")
            response = await fallbackLlm.invoke(messages)
        }

        const answerText = typeof response.content === "string" ? response.content : JSON.stringify(response.content || "")
        console.log(`[RESPONSE] sent for "${userQuery.slice(0, 40)}..." (length: ${answerText.length} chars)`)

        // Structured source context for downstream handoffs
        const sourceContextData = {
            sourceAgent: "pdfRag",
            agent: "pdfRag",
            title: `Analysis of ${docNames}`,
            prompt: userQuery,
            content: answerText,
            documentNames: docNames,
            contextSnippet: context.slice(0, 5000),
            sources,
            timestamp: Date.now()
        }

        // Save latest RAG analysis for downstream agent handoffs
        await redis.set(ragAnalysisKey, JSON.stringify(sourceContextData), "EX", 86400)
        await saveAgentContext(conversationId, sourceContextData)

        await deductCredits(state.userId, "pdf").catch(() => {})

        return {
            ...state,
            agent: "pdfRag",
            aiResponse: answerText,
            sourceContext: sourceContextData,
            sources: sources.length > 0 ? sources : undefined
        }

    } catch (error) {
        console.error("RAG Agent Error:", error)
        return {
            ...state,
            agent: "pdfRag",
            aiResponse: error?.data?.message || `⚠️ Failed to analyze file: ${error.message}`
        }
    } finally {
        if (state.file?.path) {
            fs.unlink(state.file.path, () => {})
        }
    }
}