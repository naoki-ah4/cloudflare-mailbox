import {
  RateLimitRecordSchema,
  RateLimitResultSchema,
  type RateLimitRecord,
  type RateLimitResult,
} from "./schema";

export const RateLimitKV = {
  /**
   * レート制限をチェック
   */
  async checkRateLimit(
    kv: KVNamespace,
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // 現在の試行記録を取得
      const record = await this.get(kv, key);
      let attempts = 0;
      let firstAttempt = now;

      if (record) {
        attempts = record.attempts;
        firstAttempt = record.firstAttempt;
      }

      // ウィンドウ期間外の場合はリセット
      if (firstAttempt < windowStart) {
        attempts = 0;
        firstAttempt = now;
      }

      // 制限に達している場合
      if (attempts >= limit) {
        const resetTime = firstAttempt + windowMs;
        const remainingMs = resetTime - now;

        return RateLimitResultSchema.parse({
          allowed: false,
          remaining: 0,
          resetTime,
          message: `試行回数が上限に達しました。${Math.ceil(remainingMs / 1000 / 60)}分後に再試行してください。`,
        });
      }

      // カウンターを増加
      const newRecord: RateLimitRecord = {
        attempts: attempts + 1,
        firstAttempt,
        lastAttempt: now,
      };

      await this.set(kv, key, newRecord, Math.ceil(windowMs / 1000));

      return RateLimitResultSchema.parse({
        allowed: true,
        remaining: limit - attempts - 1,
      });
    } catch (error) {
      console.error("Rate limit check failed:", error);
      // エラー時は制限を適用しない（可用性優先）
      return RateLimitResultSchema.parse({
        allowed: true,
        remaining: limit - 1,
      });
    }
  },

  /**
   * レートリミット記録を取得
   */
  async get(kv: KVNamespace, key: string): Promise<RateLimitRecord | null> {
    try {
      const data = await kv.get(`rate_limit:${key}`);
      if (!data) return null;

      return RateLimitRecordSchema.parse(JSON.parse(data));
    } catch (error) {
      console.error(`Failed to get rate limit record ${key}:`, error);
      return null;
    }
  },

  /**
   * レートリミット記録を設定
   */
  async set(
    kv: KVNamespace,
    key: string,
    record: RateLimitRecord,
    expirationTtl?: number
  ): Promise<void> {
    const validatedRecord = RateLimitRecordSchema.parse(record);
    const options = expirationTtl ? { expirationTtl } : undefined;
    await kv.put(`rate_limit:${key}`, JSON.stringify(validatedRecord), options);
  },

  /**
   * レートリミット記録を削除
   */
  async delete(kv: KVNamespace, key: string): Promise<void> {
    await kv.delete(`rate_limit:${key}`);
  },

  /**
   * 指定したプレフィックスの全レートリミット記録を削除
   */
  async deleteByPrefix(kv: KVNamespace, prefix: string): Promise<number> {
    const recordList = await kv.list({ prefix: `rate_limit:${prefix}` });
    let deletedCount = 0;

    for (const key of recordList.keys) {
      try {
        await kv.delete(key.name);
        deletedCount++;
      } catch (error) {
        console.warn(`Error deleting rate limit record ${key.name}:`, error);
      }
    }

    return deletedCount;
  },

  /**
   * ログイン試行のレート制限（IP単位）
   */
  async checkLoginRateLimit(
    kv: KVNamespace,
    ip: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(
      kv,
      `login:${ip}`,
      5, // 5回まで
      15 * 60 * 1000 // 15分間
    );
  },

  /**
   * 管理者ログイン試行のレート制限（より厳格）
   * 環境変数 DISABLE_ADMIN_RATE_LIMIT="true" でバイパス可能
   */
  async checkAdminLoginRateLimit(
    kv: KVNamespace,
    ip: string,
    env?: { DISABLE_ADMIN_RATE_LIMIT?: string }
  ): Promise<RateLimitResult> {
    // 環境変数でレート制限を無効化
    if (env?.DISABLE_ADMIN_RATE_LIMIT === "true") {
      return {
        allowed: true,
        remaining: 999,
        message: "管理者レート制限は無効化されています",
      };
    }

    return this.checkRateLimit(
      kv,
      `admin_login:${ip}`,
      3, // 3回まで
      30 * 60 * 1000 // 30分間
    );
  },

  /**
   * サインアップ試行のレート制限
   */
  async checkSignupRateLimit(
    kv: KVNamespace,
    ip: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(
      kv,
      `signup:${ip}`,
      3, // 3回まで
      60 * 60 * 1000 // 60分間
    );
  },

  /**
   * API呼び出しのレート制限
   */
  async checkApiRateLimit(
    kv: KVNamespace,
    ip: string,
    endpoint: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(
      kv,
      `api:${endpoint}:${ip}`,
      100, // 100回まで
      60 * 60 * 1000 // 60分間
    );
  },

  /**
   * レート制限をクリア（成功ログイン時など）
   */
  async clearRateLimit(kv: KVNamespace, key: string): Promise<void> {
    try {
      await this.delete(kv, key);
    } catch (error) {
      console.error("Failed to clear rate limit:", error);
    }
  },

  /**
   * ログイン成功時のレート制限クリア
   */
  async clearLoginRateLimit(kv: KVNamespace, ip: string): Promise<void> {
    await this.clearRateLimit(kv, `login:${ip}`);
  },

  /**
   * 管理者ログイン成功時のレート制限クリア
   */
  async clearAdminLoginRateLimit(
    kv: KVNamespace,
    ip: string,
    env?: { DISABLE_ADMIN_RATE_LIMIT?: string }
  ): Promise<void> {
    // レート制限が無効化されている場合は何もしない
    if (env?.DISABLE_ADMIN_RATE_LIMIT === "true") {
      return;
    }

    await this.clearRateLimit(kv, `admin_login:${ip}`);
  },
};
