import { AdminKV, AdminSessionKV, SessionKV } from "~/utils/kv";
import { isIPInCIDRList } from "~/utils/cidr";
import { getAdminSession, getUserSession } from "~/utils/session.server";
import { logger } from "~/utils/logger";

export type AuthResult = {
  isAuthenticated: boolean;
  redirect?: string;
};

/**
 * 管理者認証チェック
 */
export const authenticateAdmin = async (
  request: Request,
  env: Env
): Promise<AuthResult> => {
  const url = new URL(request.url);

  // 1. IP制限チェック（開発環境ではスキップ）
  if (env.NODE_ENV !== "development") {
    const clientIP = request.headers.get("CF-Connecting-IP");
    if (!clientIP || !isIPInCIDRList(clientIP, env.ADMIN_IPS)) {
      logger.securityLog("管理者認証失敗: IP制限", { clientIP, adminIPs: env.ADMIN_IPS });
      return { isAuthenticated: false };
    }
  }

  // 2. セットアップページは管理者0人時のみアクセス可能
  if (url.pathname === "/admin/setup" || url.pathname === "/admin/setup.data") {
    const adminCount = await AdminKV.count(env.USERS_KV);
    return { isAuthenticated: adminCount === 0 };
  }

  // 3. ログインページはIP制限のみでアクセス可能
  if (url.pathname === "/admin/login" || url.pathname === "/admin/login.data") {
    return { isAuthenticated: true };
  }

  // 4. その他の管理者ページはReact Routerセッション認証必須
  try {
    const session = await getAdminSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return { isAuthenticated: false, redirect: "/admin/login" };
    }

    // KVからセッションデータを取得
    const kvSession = await AdminSessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      logger.authLog("管理者セッション認証失敗: 無効なセッション", kvSession?.adminId ?? undefined, { sessionId });
      return { isAuthenticated: false, redirect: "/admin/login" };
    }

    // 管理者存在確認
    const admin = await AdminKV.get(env.USERS_KV, kvSession.adminId);
    if (!admin) {
      logger.authLog("管理者セッション認証失敗: 管理者が存在しない", kvSession.adminId, { sessionId });
      return { isAuthenticated: false, redirect: "/admin/login" };
    }

    logger.authLog("管理者認証成功", kvSession.adminId, { sessionId });
    return { isAuthenticated: true };
  } catch (error) {
    logger.error("管理者セッションチェックエラー", { error: error as Error });
    return { isAuthenticated: false, redirect: "/admin/login" };
  }
};

/**
 * ユーザー認証チェック
 */
export const authenticateUser = async (
  request: Request,
  env: Env
): Promise<AuthResult> => {
  // React Routerセッション認証必須
  try {
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return { isAuthenticated: false, redirect: "/login" };
    }

    // KVからセッションデータを取得
    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      logger.authLog("ユーザーセッション認証失敗: 無効なセッション", kvSession?.userId ?? undefined, { sessionId });
      return { isAuthenticated: false, redirect: "/login" };
    }

    logger.authLog("ユーザー認証成功", kvSession.userId, { sessionId });
    return { isAuthenticated: true };
  } catch (error) {
    logger.error("ユーザーセッションチェックエラー", { error: error as Error });
    return { isAuthenticated: false, redirect: "/login" };
  }
};
