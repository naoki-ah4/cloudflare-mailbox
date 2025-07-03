/**
 * 送信トレイ（Outbox）のKV管理
 * 送信済みメールの保存・取得・管理
 */

import { z } from "zod";
import { SentEmailSchema, SentMessagesSchema } from "./schema";
import { logger } from "../logger";

export type SentEmail = z.infer<typeof SentEmailSchema>;

export class OutboxKV {
  /**
   * 送信済みメールを保存
   */
  static async saveSentEmail(
    kv: KVNamespace,
    userEmail: string,
    sentEmail: SentEmail
  ): Promise<void> {
    try {
      const key = `outbox:${userEmail}`;
      
      // 既存の送信済みメール一覧を取得
      const existingData = await kv.get(key);
      const existingSentEmails = existingData
        ? SentMessagesSchema.parse(JSON.parse(existingData))
        : [];

      // 新しいメールを先頭に追加
      const updatedSentEmails = [sentEmail, ...existingSentEmails];

      // 最大1000件まで保持（古いものは削除）
      const limitedSentEmails = updatedSentEmails.slice(0, 1000);

      await kv.put(key, JSON.stringify(limitedSentEmails));
      
      logger.info("送信済みメール保存", {
        context: {
          userEmail,
          sentEmailId: sentEmail.id,
          totalCount: limitedSentEmails.length,
        },
      });
    } catch (error) {
      logger.error("送信済みメール保存エラー", {
        error: error as Error,
        context: { userEmail, sentEmailId: sentEmail.id },
      });
      throw error;
    }
  }

  /**
   * ユーザーの送信済みメール一覧を取得
   */
  static async getSentEmails(
    kv: KVNamespace,
    userEmail: string,
    limit = 50,
    offset = 0
  ): Promise<SentEmail[]> {
    try {
      const key = `outbox:${userEmail}`;
      const data = await kv.get(key);
      
      if (!data) {
        return [];
      }

      const sentEmails = SentMessagesSchema.parse(JSON.parse(data));
      
      // ページネーション
      const paginatedEmails = sentEmails.slice(offset, offset + limit);
      
      logger.info("送信済みメール取得", {
        context: {
          userEmail,
          totalCount: sentEmails.length,
          returnedCount: paginatedEmails.length,
          offset,
          limit,
        },
      });

      return paginatedEmails;
    } catch (error) {
      logger.error("送信済みメール取得エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }

  /**
   * 特定の送信済みメールを取得
   */
  static async getSentEmailById(
    kv: KVNamespace,
    userEmail: string,
    emailId: string
  ): Promise<SentEmail | null> {
    try {
      const sentEmails = await this.getSentEmails(kv, userEmail, 1000);
      const foundEmail = sentEmails.find((email) => email.id === emailId);
      
      if (foundEmail) {
        logger.info("送信済みメール詳細取得", {
          context: { userEmail, emailId },
        });
      }

      return foundEmail || null;
    } catch (error) {
      logger.error("送信済みメール詳細取得エラー", {
        error: error as Error,
        context: { userEmail, emailId },
      });
      throw error;
    }
  }

  /**
   * 送信ステータスを更新
   */
  static async updateEmailStatus(
    kv: KVNamespace,
    userEmail: string,
    emailId: string,
    status: "sent" | "failed" | "bounced"
  ): Promise<void> {
    try {
      const key = `outbox:${userEmail}`;
      const data = await kv.get(key);
      
      if (!data) {
        throw new Error("送信済みメールが見つかりません");
      }

      const sentEmails = SentMessagesSchema.parse(JSON.parse(data));
      const emailIndex = sentEmails.findIndex((email) => email.id === emailId);
      
      if (emailIndex === -1) {
        throw new Error("指定されたメールが見つかりません");
      }

      // ステータスを更新
      sentEmails[emailIndex].status = status;
      
      await kv.put(key, JSON.stringify(sentEmails));
      
      logger.info("送信ステータス更新", {
        context: { userEmail, emailId, status },
      });
    } catch (error) {
      logger.error("送信ステータス更新エラー", {
        error: error as Error,
        context: { userEmail, emailId, status },
      });
      throw error;
    }
  }

  /**
   * 送信統計を取得
   */
  static async getSentEmailStats(
    kv: KVNamespace,
    userEmail: string
  ): Promise<{
    totalCount: number;
    sentCount: number;
    failedCount: number;
    bouncedCount: number;
    lastSentAt?: string;
  }> {
    try {
      const sentEmails = await this.getSentEmails(kv, userEmail, 1000);
      
      const stats = {
        totalCount: sentEmails.length,
        sentCount: sentEmails.filter((e) => e.status === "sent").length,
        failedCount: sentEmails.filter((e) => e.status === "failed").length,
        bouncedCount: sentEmails.filter((e) => e.status === "bounced").length,
        lastSentAt: sentEmails.length > 0 ? sentEmails[0].sentAt : undefined,
      };
      
      logger.info("送信統計取得", {
        context: { userEmail, ...stats },
      });

      return stats;
    } catch (error) {
      logger.error("送信統計取得エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }

  /**
   * 古い送信済みメールを削除（メンテナンス用）
   */
  static async cleanupOldSentEmails(
    kv: KVNamespace,
    userEmail: string,
    maxAge = 365 * 24 * 60 * 60 * 1000 // 1年
  ): Promise<number> {
    try {
      const key = `outbox:${userEmail}`;
      const data = await kv.get(key);
      
      if (!data) {
        return 0;
      }

      const sentEmails = SentMessagesSchema.parse(JSON.parse(data));
      const cutoffTime = new Date(Date.now() - maxAge).toISOString();
      
      const recentEmails = sentEmails.filter(
        (email) => email.sentAt > cutoffTime
      );
      
      const deletedCount = sentEmails.length - recentEmails.length;
      
      if (deletedCount > 0) {
        await kv.put(key, JSON.stringify(recentEmails));
        
        logger.info("古い送信済みメール削除", {
          context: { userEmail, deletedCount, remainingCount: recentEmails.length },
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error("古い送信済みメール削除エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }
}