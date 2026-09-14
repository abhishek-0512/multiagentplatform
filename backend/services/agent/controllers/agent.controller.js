import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"

export const agent = async (req, res) => {
    try {
        const { prompt, conversationId, agent } = req.body
        const file = req.file
        const userId = req.headers["x-user-id"]
        const chatServiceUrl = process.env.CHAT_SERVICE || "http://127.0.0.1:8002"

        try {
            await axios.post(`${chatServiceUrl}/save-message`, {
                conversationId,
                role: "user",
                content: prompt
            })
        } catch (saveErr) {
            console.error("Failed to save user message:", saveErr?.message)
        }

        if (conversationId && prompt) {
            await addMessage(conversationId, "user", prompt)
        }

        const result = await graph.invoke({
            prompt,
            conversationId,
            agent,
            userId,
            file
        })

        if (conversationId && result?.aiResponse) {
            await addMessage(conversationId, "assistant", result.aiResponse)
        }

        try {
            await axios.post(`${chatServiceUrl}/save-message`, {
                conversationId,
                role: "assistant",
                content: result?.aiResponse,
                images: result?.images,
                artifacts: result?.artifacts
            })
        } catch (saveErr) {
            console.error("Failed to save assistant message:", saveErr?.message)
        }

        return res.status(200).json({
            answer: result?.aiResponse,
            images: result?.images,
            artifacts: result?.artifacts
        })
    } catch (error) {
        console.error("Agent error:", error)
        return res.status(500).json({
            message: error?.response?.data?.message || error?.message || "Agent execution error"
        })
    }
}