import { useLoaderData, useActionData, Form } from "react-router";
import type { Route } from "./+types/messages.$messageId";
import { SessionKV, MessageKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import { useState, useEffect } from "react";
import {
  sanitizeHTML,
  sanitizeFileName,
  sanitizeEmailText,
} from "~/utils/sanitize";
import { SafeFormData } from "~/app/utils/formdata";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "メール詳細 - Cloudflare Mailbox" },
    {
      name: "description",
      content: "メールの詳細表示と添付ファイルの管理",
    },
  ];
};

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
    if (!canAccess && !message.isCatchAll) {
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

    const formData = SafeFormData.fromObject(await request.formData());
    const action = formData.get("action");

    if (action === "markRead" || action === "markUnread") {
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

      const isRead = action === "markRead";

      // 各受信者のInboxで既読/未読状態を更新
      const updatePromises = message.to
        .filter((email) => kvSession.managedEmails.includes(email))
        .map((email) =>
          InboxKV.updateReadStatus(env.MAILBOXES_KV, email, messageId, isRead)
        );

      await Promise.all(updatePromises);

      return {
        success: true,
        message: isRead ? "既読にしました" : "未読にしました",
        isRead,
      };
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
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false);

  useEffect(() => {
    const markAsRead = async () => {
      if (isMarkedAsRead) return;

      try {
        const formData = new FormData();
        formData.append("action", "markRead");

        const response = await fetch(`/messages/${message.id}`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          setIsMarkedAsRead(true);
        }
      } catch (error) {
        console.error("Failed to mark message as read:", error);
      }
    };

    markAsRead().catch((error) => {
      console.error("Failed to mark message as read:", error);
    });
  }, [message.id, isMarkedAsRead]);

  const handleMarkUnread = async () => {
    try {
      const formData = new FormData();
      formData.append("action", "markUnread");

      const response = await fetch(`/messages/${message.id}`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setIsMarkedAsRead(false);
      }
    } catch (error) {
      console.error("Failed to mark message as unread:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <header className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4">
        <div>
          <a
            href="/messages"
            className="text-blue-600 no-underline text-sm hover:text-blue-800"
          >
            ← メール一覧に戻る
          </a>
        </div>

        <form method="post" action="/api/logout">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer hover:bg-red-700"
          >
            ログアウト
          </button>
        </form>
      </header>

      {actionData?.error && (
        <div className="text-red-600 bg-red-50 p-4 rounded mb-4">
          {actionData.error}
        </div>
      )}

      {actionData?.success && (
        <div className="text-green-800 bg-green-100 border border-green-300 p-4 rounded mb-4">
          {actionData.message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
        {/* メッセージヘッダー */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h1 className="m-0 mb-4 text-2xl">
            {sanitizeEmailText(message.subject) || "(件名なし)"}
          </h1>

          <div className="grid grid-cols-[auto_1fr] gap-y-2 gap-x-4 text-sm text-gray-600">
            <strong className="font-bold">送信者:</strong>
            <span>{sanitizeEmailText(message.from)}</span>

            {message.originalFrom && (
              <>
                <strong className="font-bold">転送元アドレス:</strong>
                <span>{sanitizeEmailText(message.originalFrom)}</span>
              </>
            )}

            <strong className="font-bold">受信者:</strong>
            <span>{message.to.join(", ")}</span>

            <strong className="font-bold">受信先:</strong>
            <span>{recipientEmail}</span>

            <strong className="font-bold">日時:</strong>
            <span>{new Date(message.date).toLocaleString("ja-JP")}</span>

            {message.attachments.length > 0 && (
              <>
                <strong className="font-bold">添付ファイル:</strong>
                <span>{message.attachments.length}個</span>
              </>
            )}
          </div>

          <div className="mt-4">
            {isMarkedAsRead ? (
              <div className="flex items-center gap-3">
                <span className="inline-block px-4 py-2 bg-cyan-600 text-white rounded text-sm">
                  既読済み
                </span>
                <button
                  onClick={() => void handleMarkUnread()}
                  className="px-4 py-2 bg-gray-600 text-white border-none rounded cursor-pointer text-sm hover:bg-gray-700"
                >
                  未読にする
                </button>
              </div>
            ) : (
              <Form method="post" className="inline">
                <input type="hidden" name="action" value="markRead" />
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white border-none rounded cursor-pointer text-sm mt-4 hover:bg-green-700"
                >
                  既読にする
                </button>
              </Form>
            )}
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
                  className="border border-gray-300 rounded p-4 bg-gray-50 max-h-96 overflow-auto"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHTML(message.html, { allowExternalImages }),
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-inherit m-0 p-4 bg-gray-50 border border-gray-300 rounded max-h-96 overflow-auto">
                  {message.text || "テキスト版がありません"}
                </pre>
              )}
            </div>
          ) : message.text ? (
            <div>
              <h4 className="m-0 mb-2">テキスト</h4>
              <pre className="whitespace-pre-wrap font-inherit m-0 p-4 bg-gray-50 border border-gray-300 rounded max-h-96 overflow-auto">
                {message.text}
              </pre>
            </div>
          ) : null}

          {!message.html && !message.text && (
            <div className="text-center p-8 text-gray-600 italic">
              メッセージ本文がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageDetail;
