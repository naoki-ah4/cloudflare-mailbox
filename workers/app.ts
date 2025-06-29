import { createRequestHandler } from "react-router";
import EmailApp from "~/email";
import { AdminKV, AdminSessionKV, SessionKV } from "~/utils/kv";
import { isIPInCIDRList } from "~/utils/cidr";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

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

/**
 * 管理者認証チェック
 */
async function authenticateAdmin(request: Request, env: Env): Promise<{ isAuthenticated: boolean; redirect?: string }> {
  const url = new URL(request.url);
  
  // 1. IP制限チェック
  const clientIP = request.headers.get('CF-Connecting-IP');
  if (!clientIP || !isIPInCIDRList(clientIP, env.ADMIN_IPS)) {
    return { isAuthenticated: false };
  }
  
  // 2. セットアップページは管理者0人時のみアクセス可能
  if (url.pathname === '/admin/setup') {
    const adminCount = await AdminKV.count(env.USERS_KV);
    return { isAuthenticated: adminCount === 0 };
  }
  
  // 3. ログインページはIP制限のみでアクセス可能
  if (url.pathname === '/admin/login') {
    return { isAuthenticated: true };
  }
  
  // 4. その他の管理者ページはセッション認証必須
  const sessionId = getCookie(request, 'admin-session');
  if (!sessionId) {
    return { isAuthenticated: false, redirect: '/admin/login' };
  }
  
  const session = await AdminSessionKV.get(env.USERS_KV, sessionId);
  if (!session || session.expiresAt < Date.now()) {
    return { isAuthenticated: false, redirect: '/admin/login' };
  }
  
  return { isAuthenticated: true };
}

/**
 * ユーザー認証チェック
 */
async function authenticateUser(request: Request, env: Env): Promise<{ isAuthenticated: boolean; redirect?: string }> {
  const url = new URL(request.url);
  
  // ログイン・登録ページは認証不要
  if (['/login', '/signup'].includes(url.pathname) || url.pathname.startsWith('/signup?')) {
    return { isAuthenticated: true };
  }
  
  // セッション認証必須
  const sessionId = getCookie(request, 'user-session');
  if (!sessionId) {
    return { isAuthenticated: false, redirect: '/login' };
  }
  
  const session = await SessionKV.get(env.USERS_KV, sessionId);
  if (!session || session.expiresAt < Date.now()) {
    return { isAuthenticated: false, redirect: '/login' };
  }
  
  return { isAuthenticated: true };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 管理者ページの認証チェック
    if (url.pathname.startsWith('/admin')) {
      const authResult = await authenticateAdmin(request, env);
      
      if (!authResult.isAuthenticated) {
        if (authResult.redirect) {
          return Response.redirect(new URL(authResult.redirect, request.url).toString(), 302);
        }
        return new Response('Forbidden', { status: 403 });
      }
    }
    
    // ユーザーページの認証チェック
    if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/messages')) {
      const authResult = await authenticateUser(request, env);
      
      if (!authResult.isAuthenticated) {
        if (authResult.redirect) {
          return Response.redirect(new URL(authResult.redirect, request.url).toString(), 302);
        }
        return new Response('Unauthorized', { status: 401 });
      }
    }
    
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  email: EmailApp.email,
} satisfies ExportedHandler<Env>;
