import axios from "axios"

export const getMessages = async (conversationId) => {
    if (!conversationId) return []
    try {
        const chatServiceUrl = process.env.CHAT_SERVICE || "http://127.0.0.1:8002"
        const { data } = await axios.get(`${chatServiceUrl}/get-messages/${conversationId}`)
        return Array.isArray(data) ? data : []
    } catch (error) {
        console.error("getMessages error:", error?.message)
        return []
    }
}