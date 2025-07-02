import { UserSchema, type User } from "./schema";

export const UserKV = {
  async get(kv: KVNamespace, userId: string): Promise<User | null> {
    try {
      const data = await kv.get(`user:${userId}`);
      return data ? UserSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  },

  async set(kv: KVNamespace, userId: string, user: User): Promise<void> {
    const validatedUser = UserSchema.parse(user);
    await kv.put(`user:${userId}`, JSON.stringify(validatedUser));
    // ユーザー名のインデックスも作成
    await kv.put(`username:${user.username}`, userId);
  },

  async getByUsername(kv: KVNamespace, username: string): Promise<User | null> {
    try {
      // ユーザー名インデックスからユーザーIDを取得
      const userId = await kv.get(`username:${username}`);
      if (!userId) return null;

      // ユーザーIDでユーザー情報を取得
      return await this.get(kv, userId);
    } catch (error) {
      console.error(`Failed to get user by username ${username}:`, error);
      return null;
    }
  },

  async list(kv: KVNamespace): Promise<User[]> {
    const userList = await kv.list({ prefix: "user:" });
    const users: User[] = [];

    for (const key of userList.keys) {
      try {
        const user = await this.get(kv, key.name.replace("user:", ""));
        if (user) users.push(user);
      } catch (error) {
        console.warn(`Skipping invalid user data for key ${key.name}:`, error);
      }
    }

    return users;
  },

  async delete(kv: KVNamespace, userId: string): Promise<void> {
    // ユーザー情報を取得してユーザー名を確認
    const user = await this.get(kv, userId);

    // ユーザーとユーザー名インデックスの両方を削除
    await kv.delete(`user:${userId}`);
    if (user?.username) {
      await kv.delete(`username:${user.username}`);
    }
  },

  async count(kv: KVNamespace): Promise<number> {
    const userList = await kv.list({ prefix: "user:" });
    return userList.keys.length;
  },
};
