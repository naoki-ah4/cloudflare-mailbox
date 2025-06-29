export const maxAttachmentsSize = (env: Cloudflare.Env) => {
  const maxSize = env.MAX_ATTACHMENTS_SIZE
    ? parseInt(env.MAX_ATTACHMENTS_SIZE, 10)
    : 10 * 1024 * 1024; // デフォルトは10MB
  return maxSize;
};
