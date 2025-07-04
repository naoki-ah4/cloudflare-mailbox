/**
 * メール作成画面
 * /compose
 */

import {
  useActionData,
  Form,
  useNavigation,
  useLoaderData,
} from "react-router";
import type { Route } from "./+types/compose";
import { useState, useRef, useEffect } from "react";
import { getUserSession } from "~/utils/session.server";
import { SessionKV } from "~/utils/kv";
import { DraftKV } from "~/utils/kv/draft";
import type { DraftEmail } from "~/utils/kv/draft";
import { logger } from "~/utils/logger";
// Tailwindでスタイリング
import { v4 as uuidv4 } from "uuid";
import { SafeFormData } from "~/app/utils/formdata";
import { useToastContext } from "~/context/ToastContext";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "メール作成 - Cloudflare Mailbox" },
    {
      name: "description",
      content: "新しいメールを作成して送信",
    },
  ];
};

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

  try {
    // セッション認証
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return new Response("認証が必要です", { status: 401 });
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return new Response("セッションが無効です", { status: 401 });
    }

    // URLパラメーターから下書きIDや返信情報を取得
    const url = new URL(request.url);
    const draftId = url.searchParams.get("draft");
    const replyTo = url.searchParams.get("reply");

    let draftData: DraftEmail | null = null;
    let replyData: {
      subject: string;
      inReplyTo?: string;
      references?: string[];
    } | null = null;

    // 下書き読み込み
    if (draftId) {
      draftData = await DraftKV.getDraftById(
        env.USERS_KV,
        kvSession.email,
        draftId
      );
    }

    // 返信データの準備（簡略版、実際は受信メールから情報取得）
    if (replyTo) {
      replyData = {
        subject: `Re: ${replyTo}`,
        inReplyTo: replyTo,
        references: [replyTo],
      };
    }

    return {
      managedEmails: kvSession.managedEmails,
      userEmail: kvSession.email,
      draftData,
      replyData,
    };
  } catch (error) {
    logger.error("メール作成画面ローダーエラー", {
      error,
    });
    return new Response("内部サーバーエラー", { status: 500 });
  }
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

  try {
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
    const actionType = formData.get("action");
    const emailToString = formData.get("to");
    const emailCcString = formData.get("cc");
    const emailBccString = formData.get("bcc");

    if (!emailToString) {
      return { error: "宛先は必須です" };
    }

    // 宛先、CC、BCCを配列に変換
    const emailTo = emailToString
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    const emailCc = emailCcString
      ? emailCcString
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is string => typeof s === "string" && s.length > 0)
      : undefined;
    const emailBcc = emailBccString
      ? emailBccString
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is string => typeof s === "string" && s.length > 0)
      : undefined;

    const referencesString = formData.get("references");
    const references = referencesString
      ? (JSON.parse(referencesString) as string[])
      : undefined;

    if (actionType === "save_draft") {
      // 下書き保存
      const draftData: DraftEmail = {
        id: formData.get("draftId") || uuidv4(),
        from: formData.get("from") ?? "",
        to: emailTo,
        cc: emailCc,
        bcc: emailBcc,
        subject: formData.get("subject") ?? "",
        text: formData.get("text") ?? "",
        html: formData.get("html") ?? "",
        attachments: [], // TODO: 添付ファイル処理
        createdAt: formData.get("createdAt") || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inReplyTo: formData.get("inReplyTo") || undefined,
        references: references,
      };

      await DraftKV.saveDraft(env.USERS_KV, kvSession.email, draftData);

      return {
        success: true,
        message: "下書きを保存しました",
        draftId: draftData.id,
      };
    }

    return { error: "不明なアクションです" };
  } catch (error) {
    logger.error("メール作成アクションエラー", {
      error,
    });
    return { error: "処理に失敗しました" };
  }
};

const ComposeComponent = () => {
  const { managedEmails, draftData, replyData } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const { showSuccess, showError, showWarning } = useToastContext();

  // フォーム状態
  const [from, setFrom] = useState(draftData?.from || managedEmails[0] || "");
  const [to, setTo] = useState(draftData?.to?.join(", ") || "");
  const [cc, setCc] = useState(draftData?.cc?.join(", ") || "");
  const [bcc, setBcc] = useState(draftData?.bcc?.join(", ") || "");
  const [subject, setSubject] = useState(
    draftData?.subject || replyData?.subject || ""
  );
  const [text, setText] = useState(draftData?.text || "");
  const [html, setHtml] = useState(draftData?.html || "");
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(draftData?.cc?.length || draftData?.bcc?.length)
  );
  const [isHtmlMode, setIsHtmlMode] = useState(Boolean(draftData?.html));
  const draftId = draftData?.id;

  // 自動下書き保存（5秒間隔）
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (formRef.current && (to || subject || text || html)) {
        const formData = new FormData(formRef.current);
        formData.set("action", "save_draft");
        formData.set("draftId", draftId || "");

        // 自動保存の実行
        void fetch("/compose", {
          method: "POST",
          body: formData,
        });
      }
    }, 5000);

    return () => clearInterval(autoSave);
  }, [to, subject, text, html, draftId]);

  const handleSendEmail = async () => {
    if (!formRef.current) return;

    // 送信API用のデータ準備
    const sendData = new FormData();
    sendData.set("from", from);
    sendData.set(
      "to",
      JSON.stringify(
        to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    sendData.set(
      "cc",
      JSON.stringify(
        cc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    sendData.set(
      "bcc",
      JSON.stringify(
        bcc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    sendData.set("subject", subject);
    sendData.set("text", text);
    sendData.set("html", isHtmlMode ? html : "");
    sendData.set("attachments", JSON.stringify([])); // TODO: 添付ファイル
    if (replyData?.inReplyTo) {
      sendData.set("inReplyTo", replyData.inReplyTo);
    }
    if (replyData?.references) {
      sendData.set("references", JSON.stringify(replyData.references));
    }
    if (draftId) {
      sendData.set("draftId", draftId);
    }

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        body: sendData,
      });

      const result = await response.json<{
        success: boolean;
        message?: string;
        error?: string;
      }>();

      if (result.success) {
        // 送信成功時はトーストで通知してからリダイレクト
        showSuccess("送信完了", "メールが正常に送信されました");
        setTimeout(() => {
          window.location.href = "/messages";
        }, 1500);
      } else {
        // エラーの種類に応じて適切なメッセージを表示
        const errorMessage = result.error || "送信に失敗しました";
        if (errorMessage.includes("メール送信サービスが設定されていません")) {
          showWarning(
            "送信機能が利用できません",
            "管理者にお問い合わせください"
          );
        } else {
          showError("送信エラー", errorMessage);
        }
      }
    } catch (error: unknown) {
      showError("ネットワークエラー", "送信に失敗しました。もう一度お試しください");
      console.error("Send email error:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          メール作成
        </h1>
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void handleSendEmail()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            disabled={navigation.state !== "idle" || !to || !subject}
          >
            {navigation.state !== "idle" ? "送信中..." : "送信"}
          </button>
        </div>
      </header>

      {actionData?.success && (
        <div className="p-4 mb-6 rounded-lg font-medium bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
          {actionData.message}
        </div>
      )}

      {actionData?.error && (
        <div className="p-4 mb-6 rounded-lg font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {actionData.error}
        </div>
      )}

      <Form
        ref={formRef}
        method="post"
        className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6"
      >
        <input type="hidden" name="action" value="save_draft" />
        <input type="hidden" name="draftId" value={draftId || ""} />
        <input
          type="hidden"
          name="createdAt"
          value={draftData?.createdAt || ""}
        />
        {replyData?.inReplyTo && (
          <input type="hidden" name="inReplyTo" value={replyData.inReplyTo} />
        )}
        {replyData?.references && (
          <input
            type="hidden"
            name="references"
            value={JSON.stringify(replyData.references)}
          />
        )}

        <div className="space-y-2">
          <label
            htmlFor="from"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            送信者
          </label>
          <select
            id="from"
            name="from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            {managedEmails.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="to"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            宛先
          </label>
          <input
            type="email"
            id="to"
            name="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="recipient@example.com, another@example.com"
            multiple
            required
          />
        </div>

        {!showCcBcc && (
          <button
            type="button"
            onClick={() => setShowCcBcc(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            CC/BCC を追加
          </button>
        )}

        {showCcBcc && (
          <>
            <div className="space-y-2">
              <label
                htmlFor="cc"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                CC
              </label>
              <input
                type="email"
                id="cc"
                name="cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="cc@example.com, another@example.com"
                multiple
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="bcc"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                BCC
              </label>
              <input
                type="email"
                id="bcc"
                name="bcc"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="bcc@example.com, another@example.com"
                multiple
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            件名
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsHtmlMode(false)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              !isHtmlMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            テキスト
          </button>
          <button
            type="button"
            onClick={() => setIsHtmlMode(true)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              isHtmlMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            HTML
          </button>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={isHtmlMode ? "html" : "text"}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            本文
          </label>
          {isHtmlMode ? (
            <textarea
              id="html"
              name="html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y min-h-[300px]"
              rows={15}
              placeholder="HTMLメールの内容を入力してください..."
            />
          ) : (
            <textarea
              id="text"
              name="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y min-h-[300px]"
              rows={15}
              placeholder="メールの内容を入力してください..."
            />
          )}
        </div>

        {/* TODO: 添付ファイルアップロード機能 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            添付ファイル
          </label>
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
            <p className="text-gray-500 dark:text-gray-400">
              添付ファイル機能は準備中です
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            disabled={navigation.state !== "idle"}
          >
            {navigation.state !== "idle" ? "保存中..." : "下書き保存"}
          </button>
        </div>
      </Form>
    </div>
  );
};

export default ComposeComponent;
