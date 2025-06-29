import type { EmailMessage, EmailMetadata } from './types';
import { MessageKV, InboxKV, ThreadKV } from '../utils/kv';
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
  mailboxesKV: KVNamespace
) => {
  for (const recipient of emailMessage.to) {
    const metadata: EmailMetadata = {
      messageId: emailMessage.id,
      from: emailMessage.from,
      to: emailMessage.to,
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
