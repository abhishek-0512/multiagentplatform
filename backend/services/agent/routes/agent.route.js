import express from "express"
import { agent, downloadFile, viewFile } from "../controllers/agent.controller.js"
import multer from "../config/multer.js"

const router = express.Router()

router.post("/chat", multer.single("file"), agent)
router.get("/download/:filename", downloadFile)
router.get("/file/:filename", viewFile)

export default router