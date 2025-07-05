/**
 * メール作成画面
 * /compose
 */

import {
  useNavigation,
  useLoaderData,
  useActionData,
  Form,
} from "react-router";
import type { Route } from "./+types/compose";
import { useState, useCallback } from "react";
import { getUserSession } from "~/utils/session.server";
import { SessionKV } from "~/utils/kv";
import { logger } from "~/utils/logger";
import { SafeFormData } from "~/app/utils/formdata";
// Tailwindでスタイリング
// import { useToastContext } from "~/app/context/ToastContext";

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

    // URLパラメーターから返信情報を取得
    const url = new URL(request.url);
    const replyTo = url.searchParams.get("reply");

    let replyData: {
      subject: string;
      inReplyTo?: string;
      references?: string[];
    } | null = null;

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
    // セッション認証
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

    // フォームデータから値を取得
    const from = formData.get("from");
    const toValue = formData.get("to");
    const cc = formData.get("cc");
    const bcc = formData.get("bcc");
    const subject = formData.get("subject");
    const text = formData.get("text");
    const html = formData.get("html");
    const inReplyTo = formData.get("inReplyTo");
    const references = formData.get("references");

    // toを配列に変換
    const to = toValue
      ? toValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // バリデーション
    if (!from || !to.length || !subject) {
      return { error: "必須フィールドが不足しています" };
    }

    // 送信者アドレス検証
    if (!kvSession.managedEmails.includes(from)) {
      return { error: "送信者アドレスが許可されていません" };
    }

    // RESEND API キーの確認
    if (!env.RESEND_API_KEY) {
      logger.error("RESEND_API_KEY が設定されていません", {
        context: { userEmail: kvSession.email },
      });
      return { error: "メール送信サービスが設定されていません" };
    }

    // 送信データの準備
    const emailData = {
      from,
      to,
      cc: cc
        ? cc
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      bcc: bcc
        ? bcc
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      subject,
      text: text || undefined,
      html: html || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references ? (JSON.parse(references) as string[]) : undefined,
    };

    // TODO: 実際の送信処理を実装
    // 現在は成功を返す
    logger.info("メール送信リクエスト", {
      context: {
        userEmail: kvSession.email,
        from: emailData.from,
        to: emailData.to,
      },
    });

    return {
      success: true,
      message: "メールを送信しました",
    };
  } catch (error) {
    logger.error("メール送信エラー", {
      error,
    });
    return { error: "送信に失敗しました" };
  }
};

type FormState = {
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  text: string;
  html: string;
  showCcBcc: boolean;
  isHtmlMode: boolean;
};

const ComposeComponent = () => {
  const { managedEmails, replyData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  // const { showSuccess, showError, showWarning } = useToastContext();

  // フォーム状態
  const [formState, setFormState] = useState<FormState>({
    from: managedEmails[0] || "",
    to: "",
    cc: "",
    bcc: "",
    subject: replyData?.subject || "",
    text: "",
    html: "",
    showCcBcc: false,
    isHtmlMode: false,
  });

  // フォーム更新関数
  const updateFormFields = useCallback((updates: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  }, []);

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
            type="submit"
            form="compose-form"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            disabled={
              navigation.state !== "idle" || !formState.to || !formState.subject
            }
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
        id="compose-form"
        method="post"
        className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6"
      >
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
            value={formState.from}
            onChange={(e) => updateFormFields({ from: e.target.value })}
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
            value={formState.to}
            onChange={(e) => updateFormFields({ to: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="recipient@example.com, another@example.com"
            multiple
            required
          />
        </div>

        {!formState.showCcBcc && (
          <button
            type="button"
            onClick={() => updateFormFields({ showCcBcc: true })}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            CC/BCC を追加
          </button>
        )}

        {formState.showCcBcc && (
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
                value={formState.cc}
                onChange={(e) => updateFormFields({ cc: e.target.value })}
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
                value={formState.bcc}
                onChange={(e) => updateFormFields({ bcc: e.target.value })}
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
            value={formState.subject}
            onChange={(e) => updateFormFields({ subject: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => updateFormFields({ isHtmlMode: false })}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              !formState.isHtmlMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            テキスト
          </button>
          <button
            type="button"
            onClick={() => updateFormFields({ isHtmlMode: true })}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              formState.isHtmlMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            HTML
          </button>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={formState.isHtmlMode ? "html" : "text"}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            本文
          </label>
          {formState.isHtmlMode ? (
            <textarea
              id="html"
              name="html"
              value={formState.html}
              onChange={(e) => updateFormFields({ html: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y min-h-[300px]"
              rows={15}
              placeholder="HTMLメールの内容を入力してください..."
            />
          ) : (
            <textarea
              id="text"
              name="text"
              value={formState.text}
              onChange={(e) => updateFormFields({ text: e.target.value })}
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
      </Form>
    </div>
  );
};

export default ComposeComponent;
