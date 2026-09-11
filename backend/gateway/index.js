import express from "express"
import dotenv from "dotenv"
import proxy from "express-http-proxy"
import cookieParser from "cookie-parser"
dotenv.config()
import cors from "cors"
import protect from "./middleware/auth.middleware.js"
import { getCurrentUser } from "./controllers/user.controller.js"
import { proxyWithHeader } from "./utils/proxyWithHeader.js"
const port =process.env.PORT
const app=express()
app.use(cors(
  {
    origin:process.env.FRONTEND_URL,
    credentials:true
  }
))
app.use(cookieParser())
app.use("/auth",proxy(process.env.AUTH_SERVICE))
app.use("/chat",protect,proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/agent",protect,proxyWithHeader(process.env.AGENT_SERVICE))
app.get("/api/me",protect,getCurrentUser)

app.get("/",(req,res)=>{
  res.json({message:" hello from gateway"})
})
app.listen(port,()=>{ 
  console.log(`gateway started at ${port}`)
})
