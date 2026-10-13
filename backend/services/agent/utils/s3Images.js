import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { s3 } from "../config/s3.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMP_DIR = path.resolve(__dirname, "../temp")

const BUCKET = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
}

export async function storeImage(filename, buffer, contentType = "image/png") {
    const key = `generated/${filename}`

    // Always persist to local temp folder as reliable cache and fallback
    const localPath = path.join(TEMP_DIR, filename)
    try {
        fs.writeFileSync(localPath, buffer)
    } catch (fsErr) {
        console.warn("[Storage] Warning saving local temp copy:", fsErr.message)
    }

    // Attempt S3 upload if bucket is configured
    if (BUCKET && process.env.AWS_ACCESS_KEY_ID) {
        try {
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buffer,
                ContentType: contentType
            }))

            const urls = await getImageUrls(key, filename)
            return { key, ...urls, storage: "s3" }
        } catch (s3Err) {
            console.warn("[Storage] S3 upload failed, falling back to local storage:", s3Err.message)
        }
    }

    // Local file fallback routes served via Gateway
    const viewUrl = `/api/agent/file/${filename}`
    const downloadUrl = `/api/agent/download/${filename}`
    return { key: filename, viewUrl, downloadUrl, storage: "local" }
}

export async function getImageUrls(key, filename = "image.png") {
    if (!BUCKET) {
        return {
            viewUrl: `/api/agent/file/${filename}`,
            downloadUrl: `/api/agent/download/${filename}`
        }
    }

    try {
        const viewUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: key }),
            { expiresIn: 86400 } // 24 hours
        )
        const downloadUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
                ResponseContentDisposition: `attachment; filename="${filename}"`
            }),
            { expiresIn: 86400 }
        )
        return { viewUrl, downloadUrl }
    } catch (err) {
        console.warn("[Storage] Signed URL generation failed, falling back to local endpoints:", err.message)
        return {
            viewUrl: `/api/agent/file/${filename}`,
            downloadUrl: `/api/agent/download/${filename}`
        }
    }
}