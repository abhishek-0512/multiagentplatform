import axios from "axios"
import fs from "fs"
import path from "path"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"
import { saveAgentContext } from "../utils/contextManager.js"
import redis from "../../../shared/redis/redis.js"

export const agent = async (req, res, next) => {
    try {
        const { prompt, conversationId, agent: selectedAgent } = req.body
        const file = req.file
        console.log("file", file)
        const userId = req.headers["x-user-id"]
        
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role: "user", content: prompt
        }).catch(e => console.warn("Save user message warning:", e.message))
        
        const result = await graph.invoke({
            prompt, conversationId, agent: selectedAgent, userId, file
        })
        console.log("result", {
            agent: result?.agent,
            hasAiResponse: Boolean(result?.aiResponse),
            artifactsCount: result?.artifacts?.length || 0,
            sourcesCount: result?.sources?.length || 0
        })
        
        if (result?.aiResponse) {
            await addMessage(conversationId, "user", prompt).catch(() => {})
            await addMessage(conversationId, "assistant", result.aiResponse).catch(() => {})
            
            // Save structured agent context for downstream handoffs
            await saveAgentContext(conversationId, {
                agent: result?.agent || selectedAgent,
                prompt,
                content: result?.aiResponse,
                artifacts: result?.artifacts,
                sources: result?.sources,
                structuredData: result?.structuredData
            }).catch(() => {})
        }
        
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId,
            role: "assistant",
            agent: result?.agent || selectedAgent,
            content: result?.aiResponse,
            images: result?.images,
            artifacts: result?.artifacts,
            sources: result?.sources
        }).catch(e => console.warn("Save assistant message warning:", e.message))
        
        return res.status(200).json({
            answer: result?.aiResponse,
            agent: result?.agent || selectedAgent,
            images: result?.images,
            artifacts: result?.artifacts,
            sources: result?.sources
        })
    } catch (error) {
        next(error)
    }
}

export const downloadFile = async (req, res) => {
    try {
        const { filename } = req.params
        const safeName = path.basename(filename)
        const filePath = path.resolve("./temp", safeName)
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found or expired" })
        }
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`)
        return res.sendFile(filePath)
    } catch (error) {
        return res.status(500).json({ message: `Download error: ${error.message}` })
    }
}

export const viewFile = async (req, res) => {
    try {
        const { filename } = req.params
        const safeName = path.basename(filename)
        const filePath = path.resolve("./temp", safeName)
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found or expired" })
        }
        const ext = path.extname(safeName).toLowerCase()
        if (ext === ".png") res.setHeader("Content-Type", "image/png")
        else if (ext === ".jpg" || ext === ".jpeg") res.setHeader("Content-Type", "image/jpeg")
        else if (ext === ".webp") res.setHeader("Content-Type", "image/webp")
        else if (ext === ".pdf") res.setHeader("Content-Type", "application/pdf")
        
        res.setHeader("Cache-Control", "public, max-age=86400")
        return res.sendFile(filePath)
    } catch (error) {
        return res.status(500).json({ message: `View error: ${error.message}` })
    }
}