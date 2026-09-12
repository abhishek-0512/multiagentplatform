import express from "express"
import { agent } from "../controllers/agent.controller.js"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })
const router = express.Router()

router.post("/chat", upload.single("file"), agent)

export default router