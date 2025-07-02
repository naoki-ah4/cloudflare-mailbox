import {
  InboxMessagesSchema,
  type InboxMessages,
  type EmailMetadata,
} from "./schema";

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

  /**
   * 統計情報のみを取得（大量メール対応）
   */
  async getStats(
    kv: KVNamespace,
    recipient: string
  ): Promise<{
    total: number;
    unread: number;
  }> {
    try {
      const messages = await this.get(kv, recipient);
      return {
        total: messages.length,
        unread: messages.filter((msg) => !msg.isRead).length,
      };
    } catch (error) {
      console.error(`Failed to get stats for ${recipient}:`, error);
      return { total: 0, unread: 0 };
    }
  },

  /**
   * 複数メールボックスの統計を並列取得
   */
  async getMultipleStats(
    kv: KVNamespace,
    recipients: string[]
  ): Promise<{
    [email: string]: { total: number; unread: number };
  }> {
    try {
      const statsPromises = recipients.map(async (recipient) => {
        const stats = await this.getStats(kv, recipient);
        return { recipient, stats };
      });

      const results = await Promise.all(statsPromises);

      return results.reduce(
        (acc, { recipient, stats }) => {
          acc[recipient] = stats;
          return acc;
        },
        {} as { [email: string]: { total: number; unread: number } }
      );
    } catch (error) {
      console.error("Failed to get multiple stats:", error);
      return {};
    }
  },
};
