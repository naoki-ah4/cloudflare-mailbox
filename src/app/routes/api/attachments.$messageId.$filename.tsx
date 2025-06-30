import type { LoaderFunctionArgs } from "react-router";
import { generateAttachementSignedUrl } from "~/utils/attachments";
import { SessionKV, MessageKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env; ctx: ExecutionContext } }).cloudflare;

  try {
    const { messageId, filename } = params;
    if (!messageId || !filename) {
      return new Response("パラメータが不正です", { status: 400 });
    }

    // React Routerセッション確認
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return new Response("認証が必要です", { status: 401 });
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return new Response("セッションが無効です", { status: 401 });
    }

    // メッセージ取得とアクセス権限確認
    const message = await MessageKV.get(env.MESSAGES_KV, messageId);
    if (!message) {
      return new Response("メッセージが見つかりません", { status: 404 });
    }

    const canAccess = message.to.some(email => kvSession.managedEmails.includes(email));
    if (!canAccess) {
      return new Response("このメッセージにアクセスする権限がありません", { status: 403 });
    }

    // 添付ファイル検索
    const attachment = message.attachments.find(att => att.filename === filename);
    if (!attachment) {
      return new Response("添付ファイルが見つかりません", { status: 404 });
    }

    // R2からの署名付きURLを生成
    const r2PreSignedUrl = await generateAttachementSignedUrl(env, attachment, 60); // 60分の有効期限
    if (!r2PreSignedUrl) {
      return new Response("ファイルが見つかりません", { status: 404 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': r2PreSignedUrl,
      }
    })
  } catch (error) {
    console.error("Failed to download attachment:", error);
    return new Response("添付ファイルのダウンロードに失敗しました", { status: 500 });
  }
}