import { SessionSchema, type Session } from './schema';

export const SessionKV = {
  async get(kv: KVNamespace, sessionId: string): Promise<Session | null> {
    try {
      const data = await kv.get(`session:${sessionId}`);
      if (!data) return null;

      const session = SessionSchema.parse(JSON.parse(data));

      // 期限切れチェック
      if (Date.now() > session.expiresAt) {
        await this.delete(kv, sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  },

  async set(
    kv: KVNamespace,
    sessionId: string,
    session: Session
  ): Promise<void> {
    const validatedSession = SessionSchema.parse(session);
    await kv.put(`session:${sessionId}`, JSON.stringify(validatedSession));
  },

  async delete(kv: KVNamespace, sessionId: string): Promise<void> {
    await kv.delete(`session:${sessionId}`);
  },

  async deleteByUserId(kv: KVNamespace, userId: string): Promise<number> {
    const sessionList = await kv.list({ prefix: 'session:' });
    let deletedCount = 0;

    for (const key of sessionList.keys) {
      try {
        const session = await this.get(kv, key.name.replace('session:', ''));
        if (session?.userId === userId) {
          await this.delete(kv, key.name.replace('session:', ''));
          deletedCount++;
        }
      } catch (error) {
        console.warn(`Error checking session ${key.name}:`, error);
      }
    }

    return deletedCount;
  },
};
