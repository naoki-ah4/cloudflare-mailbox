import type { Email } from "postal-mime";
import type { EmailMessage } from "~/utils/schema";

export const saveAttachments = async (
  attachments: Email["attachments"],
  messageId: string,
  r2Bucket: R2Bucket,
  attachmentsSizeLimit: number = 25 * 1024 * 1024
) => {
  const savedAttachments: EmailMessage["attachments"] = [];

  let totalSize = 0;
  for (const attachment of attachments) {
    try {
      const r2Key = `${messageId}/${attachment.filename}`;
      const contentSize =
        typeof attachment.content === "string"
          ? attachment.content.length
          : attachment.content.byteLength;
      totalSize += contentSize;
      if (totalSize > attachmentsSizeLimit) {
        console.warn(
          `Attachment size limit exceeded for message ${messageId}. Skipping further attachments.`
        );
        break;
      }
      await r2Bucket.put(r2Key, attachment.content, {
        httpMetadata: {
          contentType: attachment.mimeType || "application/octet-stream",
          contentDisposition: `attachment; filename="${attachment.filename}"`,
        },
      });

      savedAttachments.push({
        filename: attachment.filename || `attachment-${crypto.randomUUID()}`,
        contentType: attachment.mimeType,
        r2Key,
        size: contentSize,
      });
    } catch (error) {
      console.error(`Error saving attachment ${attachment.filename}:`, error);
    }
  }

  return savedAttachments;
};
