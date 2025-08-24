import type { EmailMetadata, EmailMessage } from "~/utils/schema";
import { MessageKV, InboxKV, ThreadKV } from "../utils/kv";
import { MessageDB, InboxDB, ThreadDB } from "../utils/db";
import { logger } from "../utils/logger";
import type { Email } from "postal-mime";
import PostalMime from "postal-mime";
import { createMimeMessage } from "mimetext";
import { EmailMessage as CFEmailMessage } from "cloudflare:email";
/**
 * メールメッセージをKVに保存します。
 * @returns {Promise<void>}
 */
export const saveEmailToKV = async (
  emailMessage: EmailMessage,
  messagesKV: KVNamespace
) => {
  await MessageKV.set(messagesKV, emailMessage.id, emailMessage);

  if (emailMessage.threadId) {
    await ThreadKV.addMessage(
      messagesKV,
      emailMessage.threadId,
      emailMessage.id
    );
  }
};
/**
 * 受信トレイのインデックスを更新します。
 * @returns {Promise<void>}
 */
export const updateInboxIndex = async (
  emailMessage: EmailMessage,
  mailboxesKV: KVNamespace,
  options?: {
    catchAllAddress?: string;
  }
) => {
  // catch-all転送の場合は、catch-allアドレスのメールボックスに振り分け
  const recipients = options?.catchAllAddress
    ? [options.catchAllAddress]
    : emailMessage.to;

  for (const recipient of recipients) {
    const metadata: EmailMetadata = {
      messageId: emailMessage.id,
      from: emailMessage.from,
      to: emailMessage.to, // 元のtoアドレスを保持
      subject: emailMessage.subject,
      date: new Date(emailMessage.date),
      hasAttachments: emailMessage.attachments.length > 0,
      size: JSON.stringify(emailMessage).length,
      threadId: emailMessage.threadId,
    };

    await InboxKV.addMessage(mailboxesKV, recipient, metadata);
  }
};

/**
 * メールメッセージをKVから取得します。
 * @returns {Promise<EmailMessage | null>}
 */
export const getEmailFromKV = async (
  messageId: string,
  messagesKV: KVNamespace
): Promise<EmailMessage | null> => {
  return await MessageKV.get(messagesKV, messageId);
};

/**
 * 受信トレイのメール一覧を取得します。
 * @returns {Promise<EmailMetadata[]>}
 */
export const getInboxMessages = async (
  recipient: string,
  mailboxesKV: KVNamespace
): Promise<EmailMetadata[]> => {
  return await InboxKV.get(mailboxesKV, recipient);
};

/**
 * スレッドのメッセージID一覧を取得します。
 * @returns {Promise<string[]>}
 */
export const getThreadMessages = async (
  threadId: string,
  messagesKV: KVNamespace
): Promise<string[]> => {
  return await ThreadKV.get(messagesKV, threadId);
};

/**
 * メールを転送します。
 */
export const forwardEmailWithSendEmail = async (
  parsedEmail: Email | null,
  message: ForwardableEmailMessage,
  forwardTo: string,
  env: Cloudflare.Env
): Promise<void> => {
  // 既にパースしたメールデータを再利用、なければ新規解析
  if (!parsedEmail) {
    parsedEmail = await PostalMime.parse(message.raw);
  }

  const msg = createMimeMessage();
  msg.setSender(message.from);
  msg.setTo(forwardTo);
  msg.setSubject(parsedEmail.subject || "");
  msg.addMessage({
    contentType: "text/plain",
    data: parsedEmail.text || "",
  });
  msg.addMessage({
    contentType: "text/html",
    data: parsedEmail.html || parsedEmail.text || "",
  });

  const emailMessage = new CFEmailMessage(message.from, forwardTo, msg.asRaw());

  await env.SEND_EMAIL.send(emailMessage);
};

/**
 * メールメッセージをRDBに保存します（KVに影響しない安全な実装）。
 * エラーが発生してもログ出力のみ行い、例外は再スローしません。
 * @param emailMessage 保存するメールメッセージ
 * @returns {Promise<void>}
 */
export const saveEmailToRDB = async (
  emailMessage: EmailMessage
): Promise<void> => {
  try {
    await MessageDB.set(emailMessage.id, emailMessage);

    if (emailMessage.threadId) {
      await ThreadDB.addMessage(emailMessage.threadId, emailMessage.id);
    }

    logger.info("RDB書き込み成功: saveEmailToRDB", {
      messageId: emailMessage.id,
      threadId: emailMessage.threadId,
      hasThread: !!emailMessage.threadId,
    });
  } catch (error) {
    // 絶対に例外を再スローしない - KVシステムの安全性を保証
    logger.error("RDB書き込みエラー: saveEmailToRDB", {
      error,
      messageId: emailMessage.id,
      threadId: emailMessage.threadId,
      from: emailMessage.from,
      subject: emailMessage.subject,
    });
  }
};

/**
 * 受信トレイのインデックスをRDBに更新します（KVに影響しない安全な実装）。
 * エラーが発生してもログ出力のみ行い、例外は再スローしません。
 * @param emailMessage 更新するメールメッセージ
 * @param options オプション設定
 * @returns {Promise<void>}
 */
export const updateInboxIndexInRDB = async (
  emailMessage: EmailMessage,
  options?: {
    catchAllAddress?: string;
  }
): Promise<void> => {
  try {
    // catch-all転送の場合は、catch-allアドレスのメールボックスに振り分け
    const recipients = options?.catchAllAddress
      ? [options.catchAllAddress]
      : emailMessage.to;

    for (const recipient of recipients) {
      const metadata: EmailMetadata = {
        messageId: emailMessage.id,
        from: emailMessage.from,
        to: emailMessage.to, // 元のtoアドレスを保持
        subject: emailMessage.subject,
        date: new Date(emailMessage.date),
        hasAttachments: emailMessage.attachments.length > 0,
        size: JSON.stringify(emailMessage).length,
        threadId: emailMessage.threadId,
      };

      await InboxDB.addMessage(recipient, metadata);
    }

    logger.info("RDB書き込み成功: updateInboxIndexInRDB", {
      messageId: emailMessage.id,
      recipientCount: recipients.length,
      recipients: recipients,
      catchAllUsed: !!options?.catchAllAddress,
    });
  } catch (error) {
    // 絶対に例外を再スローしない - KVシステムの安全性を保証
    logger.error("RDB書き込みエラー: updateInboxIndexInRDB", {
      error,
      messageId: emailMessage.id,
      originalRecipients: emailMessage.to,
      catchAllAddress: options?.catchAllAddress,
      from: emailMessage.from,
      subject: emailMessage.subject,
    });
  }
};
