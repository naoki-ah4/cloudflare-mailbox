/**
 * 下書き（Draft）のKV管理
 * 下書きメールの保存・取得・管理
 */

import { z } from "zod";
import { DraftEmailSchema, DraftMessagesSchema } from "../schema";
import { logger } from "../logger";

export type DraftEmail = z.infer<typeof DraftEmailSchema>;

export class DraftKV {
  /**
   * 下書きを保存
   */
  static async saveDraft(
    kv: KVNamespace,
    userEmail: string,
    draft: DraftEmail
  ): Promise<void> {
    try {
      const key = `drafts:${userEmail}`;

      // 既存の下書き一覧を取得
      const existingData = await kv.get(key);
      const existingDrafts = existingData
        ? DraftMessagesSchema.parse(JSON.parse(existingData))
        : [];

      // 同じIDの下書きがある場合は更新、なければ追加
      const existingIndex = existingDrafts.findIndex((d) => d.id === draft.id);

      if (existingIndex >= 0) {
        existingDrafts[existingIndex] = {
          ...draft,
          updatedAt: new Date().toISOString(),
        };
      } else {
        existingDrafts.unshift(draft);
      }

      // 最大100件まで保持
      const limitedDrafts = existingDrafts.slice(0, 100);

      await kv.put(key, JSON.stringify(limitedDrafts));

      logger.info("下書き保存", {
        context: {
          userEmail,
          draftId: draft.id,
          isUpdate: existingIndex >= 0,
          totalCount: limitedDrafts.length,
        },
      });
    } catch (error) {
      logger.error("下書き保存エラー", {
        error: error as Error,
        context: { userEmail, draftId: draft.id },
      });
      throw error;
    }
  }

  /**
   * ユーザーの下書き一覧を取得
   */
  static async getDrafts(
    kv: KVNamespace,
    userEmail: string
  ): Promise<DraftEmail[]> {
    try {
      const key = `drafts:${userEmail}`;
      const data = await kv.get(key);

      if (!data) {
        return [];
      }

      const drafts = DraftMessagesSchema.parse(JSON.parse(data));

      // 更新日時順でソート（新しい順）
      const sortedDrafts = drafts.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      logger.info("下書き一覧取得", {
        context: {
          userEmail,
          count: sortedDrafts.length,
        },
      });

      return sortedDrafts;
    } catch (error) {
      logger.error("下書き一覧取得エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }

  /**
   * 特定の下書きを取得
   */
  static async getDraftById(
    kv: KVNamespace,
    userEmail: string,
    draftId: string
  ): Promise<DraftEmail | null> {
    try {
      const drafts = await this.getDrafts(kv, userEmail);
      const foundDraft = drafts.find((draft) => draft.id === draftId);

      if (foundDraft) {
        logger.info("下書き詳細取得", {
          context: { userEmail, draftId },
        });
      }

      return foundDraft || null;
    } catch (error) {
      logger.error("下書き詳細取得エラー", {
        error: error as Error,
        context: { userEmail, draftId },
      });
      throw error;
    }
  }

  /**
   * 下書きを削除
   */
  static async deleteDraft(
    kv: KVNamespace,
    userEmail: string,
    draftId: string
  ): Promise<boolean> {
    try {
      const key = `drafts:${userEmail}`;
      const data = await kv.get(key);

      if (!data) {
        return false;
      }

      const drafts = DraftMessagesSchema.parse(JSON.parse(data));
      const filteredDrafts = drafts.filter((draft) => draft.id !== draftId);

      if (filteredDrafts.length === drafts.length) {
        // 削除対象が見つからなかった
        return false;
      }

      await kv.put(key, JSON.stringify(filteredDrafts));

      logger.info("下書き削除", {
        context: {
          userEmail,
          draftId,
          remainingCount: filteredDrafts.length,
        },
      });

      return true;
    } catch (error) {
      logger.error("下書き削除エラー", {
        error: error as Error,
        context: { userEmail, draftId },
      });
      throw error;
    }
  }

  /**
   * 全ての下書きを削除
   */
  static async deleteAllDrafts(
    kv: KVNamespace,
    userEmail: string
  ): Promise<number> {
    try {
      const key = `drafts:${userEmail}`;
      const data = await kv.get(key);

      if (!data) {
        return 0;
      }

      const drafts = DraftMessagesSchema.parse(JSON.parse(data));
      const deletedCount = drafts.length;

      await kv.delete(key);

      logger.info("全下書き削除", {
        context: { userEmail, deletedCount },
      });

      return deletedCount;
    } catch (error) {
      logger.error("全下書き削除エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }

  /**
   * 古い下書きを自動削除（メンテナンス用）
   */
  static async cleanupOldDrafts(
    kv: KVNamespace,
    userEmail: string,
    maxAge = 30 * 24 * 60 * 60 * 1000 // 30日
  ): Promise<number> {
    try {
      const key = `drafts:${userEmail}`;
      const data = await kv.get(key);

      if (!data) {
        return 0;
      }

      const drafts = DraftMessagesSchema.parse(JSON.parse(data));
      const cutoffTime = new Date(Date.now() - maxAge).toISOString();

      const recentDrafts = drafts.filter(
        (draft) => draft.updatedAt > cutoffTime
      );

      const deletedCount = drafts.length - recentDrafts.length;

      if (deletedCount > 0) {
        await kv.put(key, JSON.stringify(recentDrafts));

        logger.info("古い下書き削除", {
          context: {
            userEmail,
            deletedCount,
            remainingCount: recentDrafts.length,
          },
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error("古い下書き削除エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }

  /**
   * 下書き統計を取得
   */
  static async getDraftStats(
    kv: KVNamespace,
    userEmail: string
  ): Promise<{
    totalCount: number;
    lastUpdatedAt?: string;
    oldestDraftAt?: string;
  }> {
    try {
      const drafts = await this.getDrafts(kv, userEmail);

      const stats = {
        totalCount: drafts.length,
        lastUpdatedAt: drafts.length > 0 ? drafts[0].updatedAt : undefined,
        oldestDraftAt:
          drafts.length > 0 ? drafts[drafts.length - 1].updatedAt : undefined,
      };

      logger.info("下書き統計取得", {
        context: { userEmail, ...stats },
      });

      return stats;
    } catch (error) {
      logger.error("下書き統計取得エラー", {
        error: error as Error,
        context: { userEmail },
      });
      throw error;
    }
  }
}
