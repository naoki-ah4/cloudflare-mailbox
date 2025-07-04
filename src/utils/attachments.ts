import type { EmailMessage } from "~/utils/kv/schema";

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
  const client = await createS3Client(env);

  const url = await client.presignedGetObject(
    env.R2_BUCKET_NAME,
    r2Key,
    expirationMinutes * 60
  );
  return url;
};

const createS3Client = async (env: Cloudflare.Env) => {
  if (
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.CLOUDFLARE_ACCOUNT_ID
  ) {
    throw new Error("R2 configuration is incomplete");
  }
  // TODO: 静的インポートに修正する
  // Viteがminioを正常にインポートできないので一時的に動的インポートをするが、修正はマージ済みなので近いうちに直す
  // https://github.com/cloudflare/workers-sdk/issues/9225
  const Minio = await import("minio").catch(() => {
    console.error(
      "Minio clientのインポートに失敗しました。開発環境では既知の問題で、ViteがMinioを正しくインポートできないことがあります。"
    );
    throw new Error(
      "Minio client import failed. This is a known issue in the development environment where Vite cannot import Minio correctly."
    );
  });

  return new Minio.Client({
    endPoint: `${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKey: env.R2_ACCESS_KEY_ID,
    secretKey: env.R2_SECRET_ACCESS_KEY,
    useSSL: true,
    region: "auto",
  });
};
