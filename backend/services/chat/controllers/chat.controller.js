import Conversation from "../models/coversation.model.js"
import Message from "../models/message.model.js"

export const createConversation = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        const conversation = await Conversation.create({
            userId: userId
        })
        return res.status(200).json(conversation)
    } catch (error) {
        return res.status(500).json({ message: `create conversation error: ${error.message}` })
    }
}

export const getConversations = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        if (!userId) {
            return res.status(401).json({ message: "User authentication required" })
        }
        const conversations = await Conversation.find({
            userId: userId
        }).sort({ updatedAt: -1 })

        return res.status(200).json(conversations)
    } catch (error) {
        return res.status(500).json({ message: `get conversation error: ${error.message}` })
    }
}

export const updateConversation = async (req, res) => {
    try {
        const { id, title } = req.body
        const userId = req.headers["x-user-id"]

        // IDOR authorization guard: verify ownership
        const query = userId ? { _id: id, userId } : { _id: id }
        const conversation = await Conversation.findOneAndUpdate(
            query,
            { title },
            { new: true }
        )

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found or unauthorized" })
        }

        return res.status(200).json(conversation)
    } catch (error) {
        return res.status(500).json({ message: `update conversation error: ${error.message}` })
    }
}

export const saveMessage = async (req, res) => {
    try {
        const { conversationId, role, agent, content, images, artifacts, sources } = req.body
        const message = await Message.create({
            conversationId,
            content,
            role,
            agent,
            images,
            artifacts,
            sources
        })
        return res.status(200).json(message)
    } catch (error) {
        return res.status(500).json({ message: `save message error: ${error.message}` })
    }
}

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params
        const userId = req.headers["x-user-id"]

        // If user ID is passed, check ownership
        if (userId) {
            const conversation = await Conversation.findById(conversationId)
            if (conversation && conversation.userId && conversation.userId !== userId) {
                return res.status(403).json({ message: "Access forbidden: Conversation does not belong to user" })
            }
        }

        const messages = await Message.find({
            conversationId
        }).sort({ createdAt: 1 })

        return res.status(200).json(messages)
    } catch (error) {
        return res.status(500).json({ message: `get messages error: ${error.message}` })
    }
}
