import {
  InboxMessagesSchema,
  type InboxMessages,
  type EmailMetadata,
} from './schema';

export const InboxKV = {
  async get(kv: KVNamespace, recipient: string): Promise<InboxMessages> {
    try {
      const data = await kv.get(`inbox:${recipient}`);
      return data ? InboxMessagesSchema.parse(JSON.parse(data)) : [];
    } catch (error) {
      console.error(`Failed to get inbox for ${recipient}:`, error);
      return [];
    }
  },

  async set(
    kv: KVNamespace,
    recipient: string,
    messages: InboxMessages
  ): Promise<void> {
    const validatedMessages = InboxMessagesSchema.parse(messages);
    await kv.put(`inbox:${recipient}`, JSON.stringify(validatedMessages));
  },

  async addMessage(
    kv: KVNamespace,
    recipient: string,
    metadata: EmailMetadata
  ): Promise<void> {
    const existingMessages = await this.get(kv, recipient);
    existingMessages.unshift(metadata); // 新しいメッセージを先頭に追加
    await this.set(kv, recipient, existingMessages);
  },

  async updateReadStatus(
    kv: KVNamespace,
    recipient: string,
    messageId: string,
    isRead: boolean
  ): Promise<boolean> {
    const messages = await this.get(kv, recipient);
    const messageIndex = messages.findIndex(
      (msg) => msg.messageId === messageId
    );

    if (messageIndex === -1) return false;

    messages[messageIndex] = {
      ...messages[messageIndex],
      isRead,
      readAt: isRead ? Date.now() : undefined,
    };

    await this.set(kv, recipient, messages);
    return true;
  },

  async delete(kv: KVNamespace, recipient: string): Promise<void> {
    await kv.delete(`inbox:${recipient}`);
  },
};
