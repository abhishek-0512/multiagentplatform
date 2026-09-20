import { PutObjectCommand } from "@aws-sdk/client-s3"
import { s3 } from "../config/s3.js"

export const uploadToS3 = async (filename, buffer, contentType) => {
    const bucket = (process.env.AWS_BUCKET_NAME || "").trim()
    const accessKey = (process.env.AWS_ACCESS_KEY_ID || "").trim()
    if (!bucket || !accessKey || accessKey === "dummy") {
        return filename
    }
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Body: buffer,
            Key: filename,
            ContentType: contentType
        })
    )
    return filename
}