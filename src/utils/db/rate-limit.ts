import { getPrismaClient } from "./index";
import type { RateLimitRecord, RateLimitResult } from "../schema";

export const RateLimitDB = {
  async get(key: string): Promise<RateLimitRecord | null> {
    const prisma = getPrismaClient();
    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!record) return null;

    return {
      attempts: record.attempts,
      firstAttempt: Number(record.firstAttempt),
      lastAttempt: Number(record.lastAttempt),
    };
  },

  async set(key: string, record: RateLimitRecord): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        attempts: record.attempts,
        firstAttempt: BigInt(record.firstAttempt),
        lastAttempt: BigInt(record.lastAttempt),
      },
      update: {
        attempts: record.attempts,
        firstAttempt: BigInt(record.firstAttempt),
        lastAttempt: BigInt(record.lastAttempt),
      },
    });
  },

  async increment(key: string): Promise<RateLimitRecord> {
    const now = Date.now();

    const existing = await this.get(key);

    if (existing) {
      const updated = {
        attempts: existing.attempts + 1,
        firstAttempt: existing.firstAttempt,
        lastAttempt: now,
      };
      await this.set(key, updated);
      return updated;
    } else {
      const newRecord = {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
      await this.set(key, newRecord);
      return newRecord;
    }
  },

  async delete(key: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.rateLimit
      .delete({
        where: { key },
      })
      .catch(() => {
        // レコードが存在しない場合は無視
      });
  },

  async deleteExpired(expiryMs: number): Promise<number> {
    const prisma = getPrismaClient();
    const cutoffTime = BigInt(Date.now() - expiryMs);

    const result = await prisma.rateLimit.deleteMany({
      where: {
        lastAttempt: {
          lt: cutoffTime,
        },
      },
    });

    return result.count;
  },

  async checkLimit(
    key: string,
    maxAttempts: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const record = await this.get(key);
    const now = Date.now();

    if (!record) {
      // 初回アクセス
      await this.increment(key);
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetTime: now + windowMs,
      };
    }

    // ウィンドウ期間外の場合、リセット
    if (now - record.firstAttempt > windowMs) {
      const newRecord = {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
      await this.set(key, newRecord);
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetTime: now + windowMs,
      };
    }

    // 制限チェック
    if (record.attempts >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.firstAttempt + windowMs,
        message: `Rate limit exceeded. Try again after ${new Date(record.firstAttempt + windowMs).toISOString()}`,
      };
    }

    // 制限内なので増加
    await this.increment(key);
    return {
      allowed: true,
      remaining: maxAttempts - (record.attempts + 1),
      resetTime: record.firstAttempt + windowMs,
    };
  },

  async reset(key: string): Promise<void> {
    await this.delete(key);
  },

  async cleanup(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    return await this.deleteExpired(olderThanMs);
  },
};
