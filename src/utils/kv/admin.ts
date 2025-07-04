import {
  AdminSchema,
  AdminSessionSchema,
  type Admin,
  type AdminSession,
} from "../schema";

export const AdminKV = {
  async get(kv: KVNamespace, adminId: string): Promise<Admin | null> {
    try {
      const data = await kv.get(`admin:${adminId}`);
      return data ? AdminSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get admin ${adminId}:`, error);
      return null;
    }
  },

  async set(kv: KVNamespace, adminId: string, admin: Admin): Promise<void> {
    const validatedAdmin = AdminSchema.parse(admin);
    await kv.put(`admin:${adminId}`, JSON.stringify(validatedAdmin));
    // 管理者ユーザー名のインデックスも作成
    await kv.put(`admin-username:${admin.username}`, adminId);
  },

  async getByUsername(
    kv: KVNamespace,
    username: string
  ): Promise<Admin | null> {
    try {
      // 管理者ユーザー名インデックスから管理者IDを取得
      const adminId = await kv.get(`admin-username:${username}`);
      if (!adminId) return null;

      // 管理者IDで管理者情報を取得
      return await this.get(kv, adminId);
    } catch (error) {
      console.error(`Failed to get admin by username ${username}:`, error);
      return null;
    }
  },

  async list(kv: KVNamespace): Promise<Admin[]> {
    const adminList = await kv.list({ prefix: "admin:" });
    const admins: Admin[] = [];

    for (const key of adminList.keys) {
      try {
        const admin = await this.get(kv, key.name.replace("admin:", ""));
        if (admin) admins.push(admin);
      } catch (error) {
        console.warn(`Skipping invalid admin data for key ${key.name}:`, error);
      }
    }

    return admins;
  },

  async delete(kv: KVNamespace, adminId: string): Promise<void> {
    // 管理者情報を取得してユーザー名を確認
    const admin = await this.get(kv, adminId);

    // 管理者と管理者ユーザー名インデックスの両方を削除
    await kv.delete(`admin:${adminId}`);
    if (admin?.username) {
      await kv.delete(`admin-username:${admin.username}`);
    }
  },

  async count(kv: KVNamespace): Promise<number> {
    const adminList = await kv.list({ prefix: "admin:" });
    return adminList.keys.length;
  },
};

export const AdminSessionKV = {
  async get(kv: KVNamespace, sessionId: string): Promise<AdminSession | null> {
    try {
      const data = await kv.get(`admin-session:${sessionId}`);
      return data ? AdminSessionSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get admin session ${sessionId}:`, error);
      return null;
    }
  },

  async set(
    kv: KVNamespace,
    sessionId: string,
    session: AdminSession
  ): Promise<void> {
    const validatedSession = AdminSessionSchema.parse(session);
    // セッションは7日間で期限切れ
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    await kv.put(
      `admin-session:${sessionId}`,
      JSON.stringify(validatedSession),
      { expirationTtl: ttl }
    );
  },

  async delete(kv: KVNamespace, sessionId: string): Promise<void> {
    await kv.delete(`admin-session:${sessionId}`);
  },

  async cleanup(kv: KVNamespace): Promise<number> {
    const sessionList = await kv.list({ prefix: "admin-session:" });
    let deletedCount = 0;
    const now = Date.now();

    for (const key of sessionList.keys) {
      try {
        const session = await this.get(
          kv,
          key.name.replace("admin-session:", "")
        );
        if (session && session.expiresAt < now) {
          await this.delete(kv, key.name.replace("admin-session:", ""));
          deletedCount++;
        }
      } catch (error) {
        console.warn(`Error during session cleanup for ${key.name}:`, error);
      }
    }

    return deletedCount;
  },
};
