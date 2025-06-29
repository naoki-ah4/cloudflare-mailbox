import type { ActionFunctionArgs } from "react-router";
import { SessionKV } from "~/utils/kv";
import { redirect } from "react-router";

/**
 * クッキーから値を取得
 */
function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  
  try {
    // セッションIDを取得して削除
    const sessionId = getCookie(request, 'user-session');
    if (sessionId) {
      await SessionKV.delete(env.USERS_KV, sessionId);
    }
    
    // クッキーを削除してログインページにリダイレクト
    const headers = new Headers();
    headers.set("Set-Cookie", "user-session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/");
    
    return redirect("/login", { headers });
  } catch (error) {
    console.error("User logout error:", error);
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}

// GETは許可しない
export function loader() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}