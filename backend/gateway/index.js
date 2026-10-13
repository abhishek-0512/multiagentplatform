import express from "express"
import dotenv from "dotenv"
import proxy from "express-http-proxy"
dotenv.config()
import cors from "cors"
import cookieParser from "cookie-parser"
import { getCurrentUser } from "./controllers/user.controller.js"
import protect from "./middleware/auth.middleware.js"
import { proxyWithHeader } from "./utils/proxyWithHeader.js"
import morgan from "morgan"

const port = process.env.PORT || 8000

const app = express()

// Secure CORS configuration
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost",
    "http://127.0.0.1"
].filter(Boolean)

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        const isExplicit = allowedOrigins.some(allowed => origin.startsWith(allowed))
        if (isLocal || isExplicit) {
            callback(null, true)
        } else {
            callback(new Error(`CORS blocked for origin: ${origin}`))
        }
    },
    credentials: true
}))

app.use(morgan("dev"))
app.use(cookieParser())

// Public Auth Proxy
app.use("/api/auth", proxy(process.env.AUTH_SERVICE || "http://auth:8001"))

// Public File Download & Preview Proxy
app.use("/api/agent/download", proxy(process.env.AGENT_SERVICE || "http://agent:8003", {
    proxyReqPathResolver: (req) => `/download/${req.url.replace(/^\//, "")}`
}))
app.use("/api/agent/file", proxy(process.env.AGENT_SERVICE || "http://agent:8003", {
    proxyReqPathResolver: (req) => `/file/${req.url.replace(/^\//, "")}`
}))

// Protected Microservice Proxies
app.use("/api/chat", protect, proxyWithHeader(process.env.CHAT_SERVICE || "http://chat:8002"))
app.use("/api/agent", protect, proxyWithHeader(process.env.AGENT_SERVICE || "http://agent:8003"))
app.use("/api/billing", protect, proxyWithHeader(process.env.BILLING_SERVICE || "http://billing:8004"))

// Current user profile
app.get("/api/me", protect, getCurrentUser)

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", service: "api-gateway", timestamp: new Date().toISOString() })
})
app.get("/", (req, res) => {
    res.json({ message: "Nexora AI API Gateway Online", version: "2.0" })
})

app.listen(port, () => {
    console.log(`Nexora API Gateway running on port ${port}`)
})