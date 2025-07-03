/**
 * Cloudflare Workers Cron Triggers処理
 * 定期的なバックアップとメンテナンス作業
 */

import { createFullBackup, cleanupOldBackups } from "./utils/backup";
import { logger } from "./utils/logger";

/**
 * スケジュールされたイベントのハンドラー
 */
export const handleScheduled = async (
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> => {
  const { scheduledTime, cron } = controller;

  try {
    logger.info("スケジュールタスク開始", {
      context: {
        scheduledTime: new Date(scheduledTime).toISOString(),
        cron,
      },
    });

    // cron式の時間部分で判定（柔軟性のため）
    const hour = cron.split(" ")[1];

    if (hour === "2") {
      // 深夜2時台: 日次バックアップ + クリーンアップ
      ctx.waitUntil(performDailyBackup(env));
    } else if (hour === "3") {
      // 深夜3時台: 週次バックアップ
      ctx.waitUntil(performWeeklyBackup(env));
    } else if (hour === "4") {
      // 深夜4時台: 月次バックアップ
      ctx.waitUntil(performMonthlyBackup(env));
    }

    logger.info("スケジュールタスク完了", { context: { cron } });
  } catch (error) {
    logger.error("スケジュールタスクエラー", {
      error: error as Error,
      context: {
        cron,
        scheduledTime: new Date(scheduledTime).toISOString(),
      },
    });
    throw error;
  }
};

/**
 * 日次バックアップ処理
 */
const performDailyBackup = async (env: Env): Promise<void> => {
  try {
    logger.info("日次バックアップ開始");

    // フルバックアップを作成
    const backupKey = await createFullBackup(env, "daily");

    // 古いバックアップをクリーンアップ
    await cleanupOldBackups(env);

    logger.info("日次バックアップ完了", { context: { backupKey } });
  } catch (error) {
    logger.error("日次バックアップエラー", { error: error as Error });
    throw error;
  }
};

/**
 * 週次バックアップ処理
 */
const performWeeklyBackup = async (env: Env): Promise<void> => {
  try {
    logger.info("週次バックアップ開始");

    const backupKey = await createFullBackup(env, "weekly");

    logger.info("週次バックアップ完了", { context: { backupKey } });
  } catch (error) {
    logger.error("週次バックアップエラー", { error: error as Error });
    throw error;
  }
};

/**
 * 月次バックアップ処理
 */
const performMonthlyBackup = async (env: Env): Promise<void> => {
  try {
    logger.info("月次バックアップ開始");

    const backupKey = await createFullBackup(env, "monthly");

    logger.info("月次バックアップ完了", { context: { backupKey } });
  } catch (error) {
    logger.error("月次バックアップエラー", { error: error as Error });
    throw error;
  }
};
