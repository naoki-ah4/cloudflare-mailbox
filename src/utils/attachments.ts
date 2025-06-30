import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { EmailMessage } from "~/email/types";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const generateAttachementSignedUrl = async (
    env: Env,
    attachment: EmailMessage["attachments"][number],
    expirationMinutes: number
): Promise<string> => {
    const r2Key = attachment.r2Key;
    if (!r2Key) {
        throw new Error("Attachment does not have a valid R2 key");
    }
    const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: r2Key,
    });
    const client = createS3Client(env);

    const url = await getSignedUrl(client, command, { expiresIn: expirationMinutes * 60 });
    return url;
}

const createS3Client = (env: Cloudflare.Env) => {
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("R2 configuration is incomplete");
    }
    return new S3Client({
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
        endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
}