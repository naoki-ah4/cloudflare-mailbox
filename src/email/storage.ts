import type { EmailMetadata, EmailMessage } from "~/utils/schema";
import { MessageKV, InboxKV, ThreadKV } from "../utils/kv";
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
