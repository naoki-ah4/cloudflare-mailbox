import { useLoaderData, useActionData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  listBackups,
  createFullBackup,
  restoreFromBackup,
} from "~/utils/backup";
import { getGenerationStatistics } from "~/utils/backup-generation";
import { logger } from "~/utils/logger";
import styles from "./backup.module.scss";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  try {
    // バックアップ一覧を取得
    const backups = await listBackups(env);

    // 世代管理統計を計算
    const backupFiles = backups
      .filter((b) => b.metadata)
      .map((b) => ({
        key: b.key,
        timestamp: b.metadata!.timestamp,
        backupType: b.metadata!.backupType,
        size: b.metadata!.compressedSize,
      }));

    const statistics = getGenerationStatistics(backupFiles);

    return {
      backups,
      statistics,
      error: null,
    };
  } catch (error) {
    logger.error("バックアップ一覧取得エラー", { error: error as Error });
    return {
      backups: [],
      statistics: {
        counts: { daily: 0, weekly: 0, monthly: 0, manual: 0 },
        totalSize: 0,
        oldestTimestamp: 0,
        newestTimestamp: 0,
      },
      error: "バックアップ一覧の取得に失敗しました",
    };
  }
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    if (actionType === "create_backup") {
      const backupKey = await createFullBackup(env, "manual");
      logger.adminLog("手動バックアップ作成", undefined, { backupKey });

      return {
        success: true,
        message: "バックアップを作成しました",
        backupKey,
      };
    }

    if (actionType === "restore_backup") {
      const backupKey = formData.get("backupKey") as string;
      if (!backupKey) {
        return {
          success: false,
          message: "バックアップキーが指定されていません",
        };
      }

      await restoreFromBackup(env, backupKey);
      logger.adminLog("バックアップから復旧", undefined, { backupKey });

      return {
        success: true,
        message: "バックアップから復旧しました",
      };
    }

    if (actionType === "delete_backup") {
      const backupKey = formData.get("backupKey") as string;
      if (!backupKey) {
        return {
          success: false,
          message: "バックアップキーが指定されていません",
        };
      }

      await env.ATTACHMENTS_R2.delete(backupKey);
      logger.adminLog("バックアップファイル削除", undefined, { backupKey });

      return {
        success: true,
        message: "バックアップファイルを削除しました",
      };
    }

    return {
      success: false,
      message: "不明なアクションです",
    };
  } catch (error) {
    logger.error("バックアップアクション実行エラー", {
      error: error as Error,
      context: { actionType },
    });

    return {
      success: false,
      message: "操作に失敗しました: " + (error as Error).message,
    };
  }
};

export default () => {
  const { backups, statistics, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString("ja-JP");
  };

  const getBackupTypeLabel = (type: string): string => {
    switch (type) {
      case "daily":
        return "日次";
      case "weekly":
        return "週次";
      case "monthly":
        return "月次";
      case "manual":
        return "手動";
      default:
        return type;
    }
  };

  const getBackupTypeClass = (type: string): string => {
    switch (type) {
      case "daily":
        return styles.typeDaily;
      case "weekly":
        return styles.typeWeekly;
      case "monthly":
        return styles.typeMonthly;
      case "manual":
        return styles.typeManual;
      default:
        return "";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="text-2xl font-bold">バックアップ管理</h1>
        <Form method="post">
          <input type="hidden" name="action" value="create_backup" />
          <button type="submit" className={styles.createButton}>
            手動バックアップ作成
          </button>
        </Form>
      </header>

      {actionData && (
        <div
          className={`${styles.message} ${actionData.success ? styles.success : styles.error}`}
        >
          {actionData.message}
        </div>
      )}

      {error && (
        <div className={`${styles.message} ${styles.error}`}>{error}</div>
      )}

      <div className={styles.content}>
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <h3>総バックアップ数</h3>
            <p className={styles.count}>{backups.length}</p>
          </div>
          <div className={styles.summaryCard}>
            <h3>総サイズ</h3>
            <p className={styles.size}>
              {formatFileSize(statistics.totalSize)}
            </p>
          </div>
          <div className={styles.summaryCard}>
            <h3>最新バックアップ</h3>
            <p className={styles.date}>
              {statistics.newestTimestamp > 0
                ? formatDate(statistics.newestTimestamp)
                : "未実行"}
            </p>
          </div>
        </div>

        <div className={styles.statistics}>
          <h2>世代管理統計</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h4>日次バックアップ</h4>
              <div className={styles.statValue}>
                <span className={styles.count}>{statistics.counts.daily}</span>
                <span className={styles.label}>個</span>
              </div>
              <p className={styles.retention}>7日間保持</p>
            </div>
            <div className={styles.statCard}>
              <h4>週次バックアップ</h4>
              <div className={styles.statValue}>
                <span className={styles.count}>{statistics.counts.weekly}</span>
                <span className={styles.label}>個</span>
              </div>
              <p className={styles.retention}>4週間保持</p>
            </div>
            <div className={styles.statCard}>
              <h4>月次バックアップ</h4>
              <div className={styles.statValue}>
                <span className={styles.count}>
                  {statistics.counts.monthly}
                </span>
                <span className={styles.label}>個</span>
              </div>
              <p className={styles.retention}>1年間保持</p>
            </div>
            <div className={styles.statCard}>
              <h4>手動バックアップ</h4>
              <div className={styles.statValue}>
                <span className={styles.count}>{statistics.counts.manual}</span>
                <span className={styles.label}>個</span>
              </div>
              <p className={styles.retention}>30日間保持</p>
            </div>
          </div>
          {statistics.oldestTimestamp > 0 && (
            <div className={styles.retentionInfo}>
              <p>
                <strong>保持期間:</strong>
                {formatDate(statistics.oldestTimestamp)} ～{" "}
                {formatDate(statistics.newestTimestamp)}（
                {Math.ceil(
                  (statistics.newestTimestamp - statistics.oldestTimestamp) /
                    (1000 * 60 * 60 * 24)
                )}
                日間）
              </p>
            </div>
          )}
        </div>

        <div className={styles.backupList}>
          <h2>バックアップ一覧</h2>

          {backups.length === 0 ? (
            <div className={styles.emptyState}>
              <p>バックアップがありません</p>
              <p>手動バックアップボタンから作成してください</p>
            </div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <div>作成日時</div>
                <div>種別</div>
                <div>サイズ</div>
                <div>圧縮率</div>
                <div>操作</div>
              </div>

              {backups.map((backup) => {
                if (!backup.metadata) return null;

                const compressionRatio =
                  backup.metadata.totalSize > 0
                    ? (
                        ((backup.metadata.totalSize -
                          backup.metadata.compressedSize) /
                          backup.metadata.totalSize) *
                        100
                      ).toFixed(1)
                    : "0";

                return (
                  <div key={backup.key} className={styles.tableRow}>
                    <div className={styles.dateCell}>
                      {formatDate(backup.metadata.timestamp)}
                    </div>
                    <div className={styles.typeCell}>
                      <span
                        className={`${styles.typeBadge} ${getBackupTypeClass(backup.metadata.backupType)}`}
                      >
                        {getBackupTypeLabel(backup.metadata.backupType)}
                      </span>
                    </div>
                    <div className={styles.sizeCell}>
                      <div className={styles.sizeInfo}>
                        <span className={styles.compressedSize}>
                          {formatFileSize(backup.metadata.compressedSize)}
                        </span>
                        <span className={styles.originalSize}>
                          (元: {formatFileSize(backup.metadata.totalSize)})
                        </span>
                      </div>
                    </div>
                    <div className={styles.ratioCell}>{compressionRatio}%</div>
                    <div className={styles.actionsCell}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input
                          type="hidden"
                          name="action"
                          value="restore_backup"
                        />
                        <input
                          type="hidden"
                          name="backupKey"
                          value={backup.key}
                        />
                        <button
                          type="submit"
                          className={styles.restoreButton}
                          onClick={(e) => {
                            if (
                              !confirm(
                                "バックアップから復旧しますか？現在のデータは上書きされます。"
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          復旧
                        </button>
                      </Form>
                      <Form method="post" style={{ display: "inline" }}>
                        <input
                          type="hidden"
                          name="action"
                          value="delete_backup"
                        />
                        <input
                          type="hidden"
                          name="backupKey"
                          value={backup.key}
                        />
                        <button
                          type="submit"
                          className={styles.deleteButton}
                          onClick={(e) => {
                            if (!confirm("このバックアップを削除しますか？")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          削除
                        </button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
