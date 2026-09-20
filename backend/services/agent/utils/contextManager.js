import redis from "../../../shared/redis/redis.js"
import { getMemory } from "../config/memory.js"
import { getMessages } from "./getMessages.js"

const CONTEXT_TTL = 86400 // 24 hours retention

/**
 * Persists structured agent output as conversation context for downstream handoffs.
 */
export const saveAgentContext = async (conversationId, contextData = {}) => {
  if (!conversationId) return
  const key = `agent_context:${conversationId}`
  const richKey = `rich_agent_context:${conversationId}`
  try {
    const payload = {
      agent: contextData.agent || "chat",
      prompt: contextData.prompt || "",
      summary: contextData.summary || "",
      content: contextData.content || contextData.aiResponse || "",
      title: contextData.title || "",
      documentNames: contextData.documentNames || "",
      structuredData: contextData.structuredData || {},
      artifacts: contextData.artifacts || [],
      sources: contextData.sources || [],
      timestamp: Date.now()
    }

    await redis.set(key, JSON.stringify(payload), "EX", CONTEXT_TTL)

    // Preserve rich source context from analysis / research / explanation agents
    const isSubstantiveAgent = ["pdfRag", "search", "coding", "chat", "imageAnalyzer"].includes(payload.agent)
    const isRichContent = payload.content && payload.content.length > 300 && !payload.content.includes("Download Report") && !payload.content.includes("Download Presentation")
    
    if (isSubstantiveAgent || (isRichContent && payload.agent !== "pdf" && payload.agent !== "ppt")) {
      await redis.set(richKey, JSON.stringify(payload), "EX", CONTEXT_TTL)
      console.log(`[ContextManager] Updated rich context for conv "${conversationId}" from [${payload.agent}] (${payload.content?.length || 0} chars)`)
    }

    console.log(`[ContextManager] Saved context for conv "${conversationId}" from agent [${payload.agent}] (${payload.content?.length || 0} chars)`)
  } catch (err) {
    console.warn(`[ContextManager] Error saving context:`, err.message)
  }
}

/**
 * Retrieves the most relevant prior agent context for a conversation.
 * Favors substantive analysis/findings over brief file download notifications.
 */
export const getAgentContext = async (conversationId) => {
  if (!conversationId) return null
  const richKey = `rich_agent_context:${conversationId}`
  const key = `agent_context:${conversationId}`

  // Priority 1: Check rich_agent_context (e.g. resume feedback, search research, coding breakdown)
  try {
    const richCached = await redis.get(richKey)
    if (richCached) {
      const parsed = JSON.parse(richCached)
      if (parsed && (parsed.content || parsed.structuredData)) {
        return parsed
      }
    }
  } catch (err) {}

  // Priority 2: Check rag_analysis key
  try {
    const ragKey = `rag_analysis:${conversationId}`
    const storedRag = await redis.get(ragKey)
    if (storedRag) {
      const parsedRag = JSON.parse(storedRag)
      if (parsedRag?.analysis) {
        return {
          agent: "pdfRag",
          content: parsedRag.analysis,
          documentNames: parsedRag.documentNames || "Uploaded Document",
          sources: parsedRag.sources || [],
          timestamp: parsedRag.timestamp || Date.now()
        }
      }
    }
  } catch (e) {}

  // Priority 3: Standard agent_context
  try {
    const cached = await redis.get(key)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed && (parsed.content || parsed.structuredData || parsed.artifacts?.length > 0)) {
        return parsed
      }
    }
  } catch (err) {}

  // Priority 4: parse recent assistant messages from memory
  try {
    let memory = await getMemory(conversationId)
    if (!memory || memory.length === 0) {
      memory = await getMessages(conversationId)
    }

    if (Array.isArray(memory) && memory.length > 0) {
      const assistantMessages = memory.filter(m => m.role === "assistant" && m.content)
      if (assistantMessages.length > 0) {
        // Find the richest assistant response
        const richMsg = [...assistantMessages].reverse().find(m => m.content.length > 200 && !m.content.includes("Download")) || assistantMessages[assistantMessages.length - 1]
        return {
          agent: richMsg.agent || "assistant",
          content: richMsg.content,
          artifacts: richMsg.artifacts || [],
          sources: richMsg.sources || [],
          timestamp: Date.now()
        }
      }
    }
  } catch (err) {
    console.warn(`[ContextManager] Memory fallback error:`, err.message)
  }

  return null
}

/**
 * Checks if the user's prompt references prior conversation output (e.g. "this", "this feedback", "the analysis", "above code").
 * If so, retrieves the prior context and packages a clean sourceContext.
 */
export const resolveContextReference = async (prompt = "", conversationId) => {
  const trimmed = prompt.trim()
  const lower = trimmed.toLowerCase()

  // Patterns that signify an explicit reference to previous context
  const explicitReferencePatterns = [
    /\b(of|from|with|based on|into|using)\s+(this|that|the above|these results|the feedback|the analysis|the research|the explanation|the code|the review|the information|the search results)\b/i,
    /\b(create|make|generate|export|download|put|turn|convert|compile)\s+(this|that|it|the above|the feedback|the analysis|the explanation|the research|the summary|the information|the details|the findings|what you (just )?(found|searched|explained|analyzed))\s*(into|as|in|to)?\s*(a\s+)?(pdf|ppt|presentation|slides|deck|report|document)?\b/i,
    /\b(turn this into|make a ppt from this|create a pdf of this|make slides from this|export this as|put this into|convert this into|turn the information|turn what you found)\b/i,
    /\b(the above|previous answer|previous response|earlier explanation|as discussed|from earlier|what you just found|from the search)\b/i,
    /\b(this|that|the)\s+(feedback|analysis|document analysis|uploaded document|resume analysis)\b/i
  ]

  const isExplicitReference = explicitReferencePatterns.some(pat => pat.test(lower))

  // Short commands like "create pdf", "make ppt", "generate pdf report", "make slides" with no specified topic
  const isImplicitShortCommand = /^(now\s+)?(create|make|generate|export|download|turn into)\s+(a\s+)?(pdf|ppt|presentation|slides|slide deck|pdf report|document|report)$/i.test(trimmed)

  // Check if prompt has a rich, standalone topic (e.g. "explaining how Redis works...", "about Machine Learning...", "on scalable Node.js backend...")
  const hasExplicitNewTopic = /\b(on|about|explaining|covering|describing|for)\s+([A-Za-z0-9_.\- ]{4,})/i.test(trimmed) &&
    !/\b(this|that|above|previous|uploaded|earlier)\b/i.test(trimmed)

  if ((!isExplicitReference && !isImplicitShortCommand) || hasExplicitNewTopic) {
    return { hasReference: false, sourceContext: null }
  }

  const context = await getAgentContext(conversationId)
  if (!context || !context.content) {
    return { hasReference: false, sourceContext: null }
  }

  console.log(`[ContextManager] Resolved reference "${trimmed.slice(0, 40)}..." -> Prior Agent [${context.agent}] (${context.content.length} chars)`)

  return {
    hasReference: true,
    sourceContext: {
      sourceAgent: context.agent || "previous_agent",
      title: context.title || context.summary || (context.agent === "pdfRag" ? "Document Analysis & Feedback" : "Previous Analysis"),
      content: context.content,
      documentNames: context.documentNames || "",
      structuredData: context.structuredData || {},
      sources: context.sources || [],
      artifacts: context.artifacts || []
    }
  }
}

/**
 * Detects if a single user prompt combines document analysis or web search with export
 * (e.g. "Analyze this resume and create a PDF report", "Search the latest information about Virat Kohli and make a PPT").
 */
export const detectCombinedWorkflow = (prompt = "", hasFile = false) => {
  const lower = prompt.toLowerCase().trim()
  const wantsPdf = /\b(create|make|generate|export|download|put|turn)\s+.*?\b(pdf|document report|pdf report)\b/i.test(lower) ||
                   /\b(create a pdf|generate a pdf|make a pdf|export pdf|pdf report)\b/i.test(lower)
  const wantsPpt = /\b(create|make|generate|export|download|put|turn)\s+.*?\b(ppt|presentation|slides|slide deck|powerpoint)\b/i.test(lower) ||
                   /\b(create a ppt|generate a ppt|make a ppt|make slides|make a presentation)\b/i.test(lower)

  if (hasFile && wantsPdf) {
    return { isCombined: true, primaryAgent: "pdfRag", nextAgent: "pdf" }
  }
  if (hasFile && wantsPpt) {
    return { isCombined: true, primaryAgent: "pdfRag", nextAgent: "ppt" }
  }

  // Detect Search + Export workflows (e.g., "Search the latest information about X and make a PPT")
  const hasSearchCommand = /\b(search|look\s*up|find|research|gather info(rmation)?|fetch info(rmation)?)\b/i.test(lower)
  if (hasSearchCommand && wantsPpt) {
    return { isCombined: true, primaryAgent: "search", nextAgent: "ppt" }
  }
  if (hasSearchCommand && wantsPdf) {
    return { isCombined: true, primaryAgent: "search", nextAgent: "pdf" }
  }

  return { isCombined: false, primaryAgent: null, nextAgent: null }
}
