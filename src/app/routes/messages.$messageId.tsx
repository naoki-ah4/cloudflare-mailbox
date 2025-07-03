import { useLoaderData, useActionData, Form } from "react-router";
import type { Route } from "./+types/messages.$messageId";
import { SessionKV, MessageKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import { useState } from "react";
import {
  sanitizeHTML,
  sanitizeFileName,
  sanitizeEmailText,
} from "~/utils/sanitize";
import styles from "./messages.$messageId.module.scss";

export const loader = async ({
  request,
  params,
  context,
}: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

  try {
    const messageId = params.messageId;
    if (!messageId) {
      throw new Error("メッセージIDが必要です");
    }

    // セッションからユーザー情報を取得
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      throw new Error("認証が必要です");
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      throw new Error("セッションが無効です");
    }

    // メッセージ取得
    const message = await MessageKV.get(env.MESSAGES_KV, messageId);
    if (!message) {
      throw new Error("メッセージが見つかりません");
    }

    // アクセス権限チェック
    const canAccess = message.to.some((email) =>
      kvSession.managedEmails.includes(email)
    );
    if (!canAccess) {
      throw new Error("このメッセージにアクセスする権限がありません");
    }

    // 受信者メールアドレス特定（複数の場合は最初の管理対象）
    const recipientEmail = message.to.find((email) =>
      kvSession.managedEmails.includes(email)
    );

    return {
      message,
      recipientEmail,
      user: {
        email: kvSession.email,
        managedEmails: kvSession.managedEmails,
      },
    };
  } catch (error) {
    console.error("Failed to load message:", error);
    throw new Error("メッセージの取得に失敗しました");
  }
};

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const { env } = context.cloudflare;

  try {
    const messageId = params.messageId;
    if (!messageId) {
      return { error: "メッセージIDが必要です" };
    }

    // セッション確認
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return { error: "認証が必要です" };
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return { error: "セッションが無効です" };
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;

    if (action === "markRead") {
      // メッセージ取得してアクセス権限確認
      const message = await MessageKV.get(env.MESSAGES_KV, messageId);
      if (!message) {
        return { error: "メッセージが見つかりません" };
      }

      const canAccess = message.to.some((email) =>
        kvSession.managedEmails.includes(email)
      );
      if (!canAccess) {
        return { error: "権限がありません" };
      }

      // 各受信者のInboxで既読状態を更新
      const updatePromises = message.to
        .filter((email) => kvSession.managedEmails.includes(email))
        .map((email) =>
          InboxKV.updateReadStatus(env.MAILBOXES_KV, email, messageId, true)
        );

      await Promise.all(updatePromises);

      return { success: true, message: "既読にしました" };
    }

    return { error: "無効なアクションです" };
  } catch (error) {
    console.error("Failed to perform action:", error);
    return { error: "操作に失敗しました" };
  }
};

const MessageDetail = () => {
  const { message, recipientEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [displayMode, setDisplayMode] = useState<"html" | "text">("html");
  const [allowExternalImages, setAllowExternalImages] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <a href="/messages" className={styles.backLink}>
            ← メール一覧に戻る
          </a>
        </div>

        <form method="post" action="/api/logout">
          <button type="submit" className={styles.logoutButton}>
            ログアウト
          </button>
        </form>
      </header>

      {actionData?.error && (
        <div className={styles.errorMessage}>{actionData.error}</div>
      )}

      {actionData?.success && (
        <div className={styles.successMessage}>{actionData.message}</div>
      )}

      <div className={styles.messageCard}>
        {/* メッセージヘッダー */}
        <div className={styles.messageHeader}>
          <h1>{sanitizeEmailText(message.subject) || "(件名なし)"}</h1>

          <div className={styles.messageMetaGrid}>
            <strong>送信者:</strong>
            <span>{sanitizeEmailText(message.from)}</span>

            {message.originalFrom && (
              <>
                <strong>転送元アドレス:</strong>
                <span>{sanitizeEmailText(message.originalFrom)}</span>
              </>
            )}

            <strong>受信者:</strong>
            <span>{message.to.join(", ")}</span>

            <strong>受信先:</strong>
            <span>{recipientEmail}</span>

            <strong>日時:</strong>
            <span>{new Date(message.date).toLocaleString("ja-JP")}</span>

            {message.attachments.length > 0 && (
              <>
                <strong>添付ファイル:</strong>
                <span>{message.attachments.length}個</span>
              </>
            )}
          </div>

          <div>
            <Form method="post" className="inline">
              <input type="hidden" name="action" value="markRead" />
              <button type="submit" className={styles.markReadButton}>
                既読にする
              </button>
            </Form>
          </div>
        </div>

        {/* 添付ファイル */}
        {message.attachments.length > 0 && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="m-0 mb-3 text-base">
              添付ファイル ({message.attachments.length}個)
            </h3>
            <div className="space-y-3">
              {message.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-300 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-lg">📎</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {sanitizeFileName(attachment.filename)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round(attachment.size / 1024)}KB •{" "}
                          {attachment.contentType || "application/octet-stream"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/attachments/${message.id}/${encodeURIComponent(attachment.filename)}`}
                        download={attachment.filename}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 no-underline"
                      >
                        ダウンロード
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メッセージ本文 */}
        <div className="p-6">
          {message.html ? (
            <div className="mb-4">
              <div className="flex gap-2 mb-4 text-sm flex-wrap">
                <button
                  onClick={() => setDisplayMode("html")}
                  className={`px-3 py-1 text-white border-none rounded cursor-pointer ${
                    displayMode === "html" ? "bg-blue-600" : "bg-gray-500"
                  }`}
                >
                  HTML表示
                </button>
                <button
                  onClick={() => setDisplayMode("text")}
                  className={`px-3 py-1 text-white border-none rounded cursor-pointer ${
                    displayMode === "text" ? "bg-blue-600" : "bg-gray-500"
                  }`}
                >
                  テキスト表示
                </button>
                {displayMode === "html" && (
                  <button
                    onClick={() => setAllowExternalImages(!allowExternalImages)}
                    className={`px-3 py-1 text-white border-none rounded cursor-pointer ${
                      allowExternalImages ? "bg-green-600" : "bg-orange-500"
                    }`}
                  >
                    {allowExternalImages
                      ? "🖼️ 外部画像: 許可中"
                      : "🖼️ 外部画像: ブロック中"}
                  </button>
                )}
              </div>

              {/* HTML/テキスト表示 */}
              {displayMode === "html" ? (
                <div
                  className={styles.htmlContent}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHTML(message.html, { allowExternalImages }),
                  }}
                />
              ) : (
                <pre className={styles.textContent}>
                  {message.text || "テキスト版がありません"}
                </pre>
              )}
            </div>
          ) : message.text ? (
            <div>
              <h4 className="m-0 mb-2">テキスト</h4>
              <pre className={styles.textContent}>{message.text}</pre>
            </div>
          ) : null}

          {!message.html && !message.text && (
            <div className={styles.noContentMessage}>
              メッセージ本文がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageDetail;
