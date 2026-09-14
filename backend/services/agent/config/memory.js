import redis from "../../../shared/redis/redis.js"
import { getMessages } from "../utils/getMessages.js"

export const getMemory = async (conversationId) => {
    if (!conversationId) return []
    const key = `messages-${conversationId}`
    try {
        const cached = await redis.get(key)
        if (cached) {
            const parsed = typeof cached === "string" ? JSON.parse(cached) : cached
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed
            }
        }
        
        const messages = await getMessages(conversationId)
        const safeMessages = Array.isArray(messages) ? messages : []
        if (safeMessages.length > 0) {
            await redis.set(key, JSON.stringify(safeMessages), "EX", 24 * 60 * 60)
        }
        return safeMessages
    } catch (error) {
        console.error("getMemory error:", error?.message)
        return []
    }
}

export const addMessage = async (conversationId, role, content) => {
    if (!conversationId || !content) return
    const key = `messages-${conversationId}`
    try {
        const rawMessages = await redis.get(key)
        let messages = []
        if (rawMessages) {
            const parsed = typeof rawMessages === "string" ? JSON.parse(rawMessages) : rawMessages
            messages = Array.isArray(parsed) ? parsed : []
        }
        messages.push({ role, content })

        if (messages.length > 20) {
            messages = messages.slice(-20)
        }

        await redis.set(key, JSON.stringify(messages), "EX", 24 * 60 * 60)
    } catch (error) {
        console.error("addMessage error:", error?.message)
    }
}
