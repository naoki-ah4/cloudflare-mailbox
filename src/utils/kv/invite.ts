import { InviteSchema, type Invite } from './schema';

export const InviteKV = {
  async get(kv: KVNamespace, token: string): Promise<Invite | null> {
    try {
      const data = await kv.get(`invite:${token}`);
      return data ? InviteSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get invite ${token}:`, error);
      return null;
    }
  },

  async set(kv: KVNamespace, token: string, invite: Invite): Promise<void> {
    const validatedInvite = InviteSchema.parse(invite);
    await kv.put(`invite:${token}`, JSON.stringify(validatedInvite));
  },

  async markUsed(kv: KVNamespace, token: string): Promise<void> {
    const invite = await this.get(kv, token);
    if (invite) {
      const updatedInvite = { ...invite, used: true, usedAt: Date.now() };
      await this.set(kv, token, updatedInvite);
    }
  },

  async delete(kv: KVNamespace, token: string): Promise<void> {
    await kv.delete(`invite:${token}`);
  },

  async count(kv: KVNamespace): Promise<number> {
    const inviteList = await kv.list({ prefix: 'invite:' });
    return inviteList.keys.length;
  },
};
