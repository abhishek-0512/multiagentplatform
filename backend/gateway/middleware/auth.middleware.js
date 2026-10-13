import redis from "../../shared/redis/redis.js"

const protect = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.session
        if (!sessionId) {
            return res.status(401).json({ message: "Authentication required" })
        }

        const session = await redis.get(`session-${sessionId}`)
        if (!session) {
            return res.status(401).json({ message: "Session expired or invalid" })
        }

        req.user = JSON.parse(session)
        next()
    } catch (error) {
        console.error("[Gateway Auth Error]:", error.message)
        return res.status(500).json({ message: "Internal authentication error" })
    }
}

export default protect