import { S3Client } from "@aws-sdk/client-s3";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;
const region = process.env.AWS_REGION || "ap-south-1";

// If explicit credentials are provided, use them; otherwise let AWS SDK resolve via IAM role or environment
export const s3 = (accessKeyId && secretAccessKey)
    ? new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    })
    : new S3Client({ region });