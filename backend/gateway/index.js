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
const port =process.env.PORT

const app=express()
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith("http://localhost:") || origin === process.env.FRONTEND_URL) {
            callback(null, true);
        } else {
            callback(null, origin);
        }
    },
    credentials: true
}))
app.use(morgan("dev"))
app.use(cookieParser())
const authServiceUrl = process.env.AUTH_SERVICE || "http://127.0.0.1:8001"
const chatServiceUrl = process.env.CHAT_SERVICE || "http://127.0.0.1:8002"
const agentServiceUrl = process.env.AGENT_SERVICE || "http://127.0.0.1:8003"

app.use("/api/auth", proxy(authServiceUrl))
app.use("/api/chat", protect, proxyWithHeader(chatServiceUrl))
app.use("/api/agent", protect, proxyWithHeader(agentServiceUrl))
if (process.env.BILLING_SERVICE) {
    app.use("/api/billing", protect, proxyWithHeader(process.env.BILLING_SERVICE))
}
app.get("/api/me", protect, getCurrentUser)
app.get("/",(req,res)=>{
    res.json({message:"hello from gateway v5"})
})

app.listen(port,()=>{
    console.log(`gateway started at ${port}`)
})