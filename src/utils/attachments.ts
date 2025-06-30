import type { EmailMessage } from "~/email/types";
import * as Minio from 'minio'

export const generateAttachementSignedUrl = async (
    env: Env,
    attachment: EmailMessage["attachments"][number],
    expirationMinutes: number
): Promise<string> => {
    const r2Key = attachment.r2Key;
    if (!r2Key) {
        throw new Error("Attachment does not have a valid R2 key");
    }
    if (!env.R2_BUCKET_NAME) {
        throw new Error("R2 bucket name is not configured");
    }
    const client = createS3Client(env);

    const url = await client.presignedGetObject(env.R2_BUCKET_NAME, r2Key, expirationMinutes * 60)
    return url;
}

const createS3Client = (env: Cloudflare.Env) => {
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("R2 configuration is incomplete");
    }
    return new Minio.Client({
        endPoint: `${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        accessKey: env.R2_ACCESS_KEY_ID,
        secretKey: env.R2_SECRET_ACCESS_KEY,
        useSSL: true,
        region: "auto",
    })
}