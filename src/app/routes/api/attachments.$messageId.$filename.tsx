import type { LoaderFunctionArgs } from "react-router";
import { SessionKV, MessageKV } from "~/utils/kv";

/**
 * クッキーから値を取得
 */
const getCookie = (request: Request, name: string): string | null => {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env; ctx: ExecutionContext } }).cloudflare;
  
  try {
    const { messageId, filename } = params;
    if (!messageId || !filename) {
      return new Response("パラメータが不正です", { status: 400 });
    }
    
    // セッション確認
    const sessionId = getCookie(request, 'user-session');
    if (!sessionId) {
      return new Response("認証が必要です", { status: 401 });
    }
    
    const session = await SessionKV.get(env.USERS_KV, sessionId);
    if (!session || session.expiresAt < Date.now()) {
      return new Response("セッションが無効です", { status: 401 });
    }
    
    // メッセージ取得とアクセス権限確認
    const message = await MessageKV.get(env.MESSAGES_KV, messageId);
    if (!message) {
      return new Response("メッセージが見つかりません", { status: 404 });
    }
    
    const canAccess = message.to.some(email => session.managedEmails.includes(email));
    if (!canAccess) {
      return new Response("このメッセージにアクセスする権限がありません", { status: 403 });
    }
    
    // 添付ファイル検索
    const attachment = message.attachments.find(att => att.filename === filename);
    if (!attachment) {
      return new Response("添付ファイルが見つかりません", { status: 404 });
    }
    
    // R2から添付ファイルを取得
    const r2Object = await env.ATTACHMENTS_R2.get(attachment.r2Key);
    if (!r2Object) {
      return new Response("ファイルが見つかりません", { status: 404 });
    }
    
    // ファイルを返す
    const headers = new Headers();
    headers.set('Content-Type', attachment.contentType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    headers.set('Content-Length', attachment.size.toString());
    
    return new Response(r2Object.body, {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error("Failed to download attachment:", error);
    return new Response("添付ファイルのダウンロードに失敗しました", { status: 500 });
  }
}