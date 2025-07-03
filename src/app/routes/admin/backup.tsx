import { useLoaderData, useActionData, Form } from "react-router";
import { useState, useRef } from "react";
import {
  listBackups,
  createFullBackup,
  restoreFromBackup,
} from "~/utils/backup";
import { getGenerationStatistics } from "~/utils/backup-generation";
import { logger } from "~/utils/logger";
import {
  decompressFileDeflate,
  parseDecompressedJSON,
} from "~/utils/client-compression";
import type { Route } from "./+types/backup";
import { SafeFormData } from "~/app/utils/formdata";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "バックアップ管理 - Cloudflare Mailbox" },
    {
      name: "description",
      content: "データのバックアップ作成、復旧、世代管理",
    },
  ];
};

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

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

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;
  const formData = SafeFormData.fromObject(await request.formData());
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
      const backupKey = formData.get("backupKey");
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
      const backupKey = formData.get("backupKey");
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
  const [decompressResult, setDecompressResult] = useState<string | null>(null);
  const [decompressError, setDecompressError] = useState<string | null>(null);
  const [isDecompressing, setIsDecompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "weekly":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "monthly":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "manual":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "";
    }
  };

  const handleFileDecompress = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsDecompressing(true);
    setDecompressError(null);
    setDecompressResult(null);

    try {
      const decompressedText = await decompressFileDeflate(file);

      // JSONとして解析を試行
      try {
        const jsonData =
          parseDecompressedJSON<Record<string, unknown>>(decompressedText);
        const formattedJson = JSON.stringify(jsonData, null, 2);
        setDecompressResult(formattedJson);
      } catch {
        // JSON解析に失敗した場合はプレーンテキストとして表示
        setDecompressResult(decompressedText);
      }
    } catch (error) {
      setDecompressError((error as Error).message);
    } finally {
      setIsDecompressing(false);
    }
  };

  const handleDownloadResult = () => {
    if (!decompressResult) return;

    const blob = new Blob([decompressResult], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decompressed-backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearDecompressResult = () => {
    setDecompressResult(null);
    setDecompressError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold">バックアップ管理</h1>
        <Form method="post">
          <input type="hidden" name="action" value="create_backup" />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            手動バックアップ作成
          </button>
        </Form>
      </header>

      {actionData && (
        <div
          className={`p-4 mb-6 rounded-lg font-medium ${actionData.success ? "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" : "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"}`}
        >
          {actionData.message}
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 rounded-lg font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              総バックアップ数
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {backups.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              総サイズ
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatFileSize(statistics.totalSize)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              最新バックアップ
            </h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {statistics.newestTimestamp > 0
                ? formatDate(statistics.newestTimestamp)
                : "未実行"}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            世代管理統計
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                日次バックアップ
              </h4>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.counts.daily}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  個
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                7日間保持
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                週次バックアップ
              </h4>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.counts.weekly}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  個
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                4週間保持
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                月次バックアップ
              </h4>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.counts.monthly}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  個
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                1年間保持
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                手動バックアップ
              </h4>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.counts.manual}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  個
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                30日間保持
              </p>
            </div>
          </div>
          {statistics.oldestTimestamp > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            deflateファイル解凍
          </h2>
          <p className="p-6 pb-4 text-sm text-gray-600 dark:text-gray-400">
            R2ダッシュボードからダウンロードしたdeflate圧縮バックアップファイルを解凍できます
          </p>

          <div className="p-6 pt-0 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".deflate,.dat,.backup"
              onChange={(e) => {
                void handleFileDecompress(e);
              }}
              className="hidden"
              disabled={isDecompressing}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              disabled={isDecompressing}
            >
              {isDecompressing ? "解凍中..." : "ファイルを選択"}
            </button>

            {decompressResult && (
              <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3">
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  JSONファイルとしてダウンロード
                </button>
                <button
                  type="button"
                  onClick={clearDecompressResult}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  クリア
                </button>
              </div>
            )}
          </div>

          {decompressError && (
            <div className="p-4 mb-6 rounded-lg font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              {decompressError}
            </div>
          )}

          {decompressResult && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                解凍結果
              </h3>
              <textarea
                readOnly
                value={decompressResult}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-white resize-y min-h-[200px] md:min-h-[300px]"
                rows={20}
              />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            バックアップ一覧
          </h2>

          {backups.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium mb-2">
                バックアップがありません
              </p>
              <p>手動バックアップボタンから作成してください</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="hidden md:grid grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
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
                  <div
                    key={backup.key}
                    className="md:grid md:grid-cols-5 md:gap-4 p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors last:border-b-0 space-y-3 md:space-y-0"
                  >
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      <span className="md:hidden font-medium text-gray-500 dark:text-gray-400">
                        作成日時:{" "}
                      </span>
                      {formatDate(backup.metadata.timestamp)}
                    </div>
                    <div className="flex items-center">
                      <span className="md:hidden font-medium text-gray-500 dark:text-gray-400">
                        種別:{" "}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getBackupTypeClass(backup.metadata.backupType)}`}
                      >
                        {getBackupTypeLabel(backup.metadata.backupType)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="md:hidden font-medium text-gray-500 dark:text-gray-400">
                        サイズ:{" "}
                      </span>
                      <div className="space-y-1">
                        <span className="block font-medium text-gray-900 dark:text-white">
                          {formatFileSize(backup.metadata.compressedSize)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          (元: {formatFileSize(backup.metadata.totalSize)})
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      <span className="md:hidden font-medium text-gray-500 dark:text-gray-400">
                        圧縮率:{" "}
                      </span>
                      {compressionRatio}%
                    </div>
                    <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t border-gray-200 dark:border-gray-600 md:border-t-0 justify-start">
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
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
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
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
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
