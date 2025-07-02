import { ThreadMessagesSchema, type ThreadMessages } from "./schema";

export const ThreadKV = {
  async get(kv: KVNamespace, threadId: string): Promise<ThreadMessages> {
    try {
      const data = await kv.get(`thread:${threadId}`);
      return data ? ThreadMessagesSchema.parse(JSON.parse(data)) : [];
    } catch (error) {
      console.error(`Failed to get thread ${threadId}:`, error);
      return [];
    }
  },

  async set(
    kv: KVNamespace,
    threadId: string,
    messageIds: ThreadMessages
  ): Promise<void> {
    const validatedThread = ThreadMessagesSchema.parse(messageIds);
    await kv.put(`thread:${threadId}`, JSON.stringify(validatedThread));
  },

  async addMessage(
    kv: KVNamespace,
    threadId: string,
    messageId: string
  ): Promise<void> {
    const existingMessages = await this.get(kv, threadId);
    existingMessages.push(messageId);
    await this.set(kv, threadId, existingMessages);
  },

  async delete(kv: KVNamespace, threadId: string): Promise<void> {
    await kv.delete(`thread:${threadId}`);
  },
};
