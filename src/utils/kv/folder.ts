import {
  FolderMessagesSchema,
  type FolderMessages,
  type EmailMetadata,
} from './schema';

export const FolderKV = {
  async get(
    kv: KVNamespace,
    userId: string,
    folderName: string
  ): Promise<FolderMessages> {
    try {
      const data = await kv.get(`folder:${userId}:${folderName}`);
      return data ? FolderMessagesSchema.parse(JSON.parse(data)) : [];
    } catch (error) {
      console.error(
        `Failed to get folder ${folderName} for user ${userId}:`,
        error
      );
      return [];
    }
  },

  async set(
    kv: KVNamespace,
    userId: string,
    folderName: string,
    messages: FolderMessages
  ): Promise<void> {
    const validatedMessages = FolderMessagesSchema.parse(messages);
    await kv.put(
      `folder:${userId}:${folderName}`,
      JSON.stringify(validatedMessages)
    );
  },

  async addMessage(
    kv: KVNamespace,
    userId: string,
    folderName: string,
    metadata: EmailMetadata
  ): Promise<void> {
    const existingMessages = await this.get(kv, userId, folderName);
    existingMessages.unshift(metadata);
    await this.set(kv, userId, folderName, existingMessages);
  },

  async removeMessage(
    kv: KVNamespace,
    userId: string,
    folderName: string,
    messageId: string
  ): Promise<boolean> {
    const messages = await this.get(kv, userId, folderName);
    const filteredMessages = messages.filter(
      (msg) => msg.messageId !== messageId
    );

    if (filteredMessages.length === messages.length) return false;

    await this.set(kv, userId, folderName, filteredMessages);
    return true;
  },

  async delete(
    kv: KVNamespace,
    userId: string,
    folderName: string
  ): Promise<void> {
    await kv.delete(`folder:${userId}:${folderName}`);
  },

  async list(kv: KVNamespace, userId: string): Promise<string[]> {
    const folderList = await kv.list({ prefix: `folder:${userId}:` });
    return folderList.keys.map((key) =>
      key.name.replace(`folder:${userId}:`, '')
    );
  },
};
