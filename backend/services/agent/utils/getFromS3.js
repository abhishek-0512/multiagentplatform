import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const getFromS3 = async (filename, expiresIn = 600) => {
    const bucket = (process.env.AWS_BUCKET_NAME || "").trim()
    const accessKey = (process.env.AWS_ACCESS_KEY_ID || "").trim()
    if (!bucket || !accessKey || accessKey === "dummy") {
        return ""
    }
    return await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: bucket,
            Key: filename
        }),
        { expiresIn }
    )
}