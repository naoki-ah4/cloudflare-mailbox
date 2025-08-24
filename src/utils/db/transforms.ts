// Prismaデータ型からZodスキーマ型への変換ヘルパー
import type {
  EmailMetadata as ZodEmailMetadata,
  EmailMessage as ZodEmailMessage,
} from "../schema";

// EmailMetadata用の変換関数
export function transformEmailMetadata(item: {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  hasAttachments: boolean;
  size: number;
  threadId: string | null;
  isRead: boolean;
  readAt: bigint | null;
  originalFrom: string | null;
  message: {
    recipients: Array<{ email: string; type: string }>;
  };
}): ZodEmailMetadata {
  return {
    messageId: item.messageId,
    from: item.from,
    to: item.message.recipients
      .filter((r) => r.type === "to")
      .map((r) => r.email),
    subject: item.subject,
    date: item.date,
    hasAttachments: item.hasAttachments,
    size: item.size,
    threadId: item.threadId || undefined,
    isRead: item.isRead || undefined,
    readAt: item.readAt ? Number(item.readAt) : undefined,
    originalFrom: item.originalFrom || undefined,
  };
}

// EmailMessage用の変換関数
export function transformEmailMessage(message: {
  id: string;
  from: string;
  subject: string;
  date: string;
  text: string | null;
  html: string | null;
  threadId: string | null;
  inReplyTo: string | null;
  originalFrom: string | null;
  isCatchAll: boolean;
  recipients: Array<{ email: string; type: string }>;
  attachments: Array<{
    filename: string;
    contentType: string;
    r2Key: string;
    size: number;
  }>;
  references: Array<{ reference: string }>;
}): ZodEmailMessage {
  return {
    id: message.id,
    from: message.from,
    to: message.recipients.filter((r) => r.type === "to").map((r) => r.email),
    subject: message.subject,
    date: message.date,
    text: message.text || undefined,
    html: message.html || undefined,
    attachments: message.attachments.map((att) => ({
      filename: att.filename,
      contentType: att.contentType,
      r2Key: att.r2Key,
      size: att.size,
    })),
    threadId: message.threadId || undefined,
    inReplyTo: message.inReplyTo || undefined,
    references: message.references.map((ref) => ref.reference),
    originalFrom: message.originalFrom || undefined,
    isCatchAll: message.isCatchAll,
  };
}
