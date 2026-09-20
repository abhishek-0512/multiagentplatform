import fs from "fs"
import path from "path"
import multer from "multer"

const uploadDir = path.resolve("./temp")

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDir)
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname)
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_")
        cb(null, `${Date.now()}-${base}${ext}`)
    }
})

const ALLOWED_EXTENSIONS = new Set([
    ".pdf", ".doc", ".docx", ".txt", ".csv", ".xls", ".xlsx",
    ".json", ".md", ".png", ".jpg", ".jpeg", ".webp", ".gif"
])

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase()
    const mime = file.mimetype || ""

    if (
        ALLOWED_EXTENSIONS.has(ext) ||
        mime.startsWith("image/") ||
        mime === "application/pdf" ||
        mime === "text/plain" ||
        mime === "text/csv" ||
        mime.includes("word") ||
        mime.includes("officedocument") ||
        mime.includes("spreadsheet") ||
        mime.includes("excel")
    ) {
        cb(null, true)
    } else {
        // Soft-accept any text-like file as fallback
        cb(null, true)
    }
}

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size
    }
})