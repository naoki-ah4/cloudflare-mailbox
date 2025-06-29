import { EmailMessageSchema, type EmailMessage } from './schema';

export const MessageKV = {
  async get(kv: KVNamespace, messageId: string): Promise<EmailMessage | null> {
    try {
      const data = await kv.get(`msg:${messageId}`);
      return data ? EmailMessageSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get message ${messageId}:`, error);
      return null;
    }
  },

  async set(
    kv: KVNamespace,
    messageId: string,
    message: EmailMessage
  ): Promise<void> {
    const validatedMessage = EmailMessageSchema.parse(message);
    await kv.put(`msg:${messageId}`, JSON.stringify(validatedMessage));
  },

  async delete(kv: KVNamespace, messageId: string): Promise<void> {
    await kv.delete(`msg:${messageId}`);
  },

  async count(kv: KVNamespace): Promise<number> {
    const messageList = await kv.list({ prefix: 'msg:' });
    return messageList.keys.length;
  },
};
