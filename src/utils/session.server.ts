import { createCookieSessionStorage } from "react-router";

type AdminSessionData = {
  sessionId: string;
};

type AdminSessionFlashData = {
  error: string;
  success: string;
};

type UserSessionData = {
  sessionId: string;
};

type UserSessionFlashData = {
  error: string;
  success: string;
};

// 管理者セッション
const {
  getSession: getAdminSession,
  commitSession: commitAdminSession,
  destroySession: destroyAdminSession,
} = createCookieSessionStorage<AdminSessionData, AdminSessionFlashData>({
  cookie: {
    name: "__admin_session",
    httpOnly: true,
    secure: process?.env?.NODE_ENV !== "development", // 開発環境ではSecureフラグを無効化
    secrets: ["admin-secret-key"], // TODO: 環境変数から取得
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7日間
    path: "/",
  },
});

// ユーザーセッション
const {
  getSession: getUserSession,
  commitSession: commitUserSession,
  destroySession: destroyUserSession,
} = createCookieSessionStorage<UserSessionData, UserSessionFlashData>({
  cookie: {
    name: "__user_session",
    httpOnly: true,
    secure: process?.env?.NODE_ENV !== "development", // 開発環境ではSecureフラグを無効化
    secrets: ["user-secret-key"], // TODO: 環境変数から取得
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7日間
    path: "/",
  },
});

export {
  getAdminSession,
  commitAdminSession,
  destroyAdminSession,
  getUserSession,
  commitUserSession,
  destroyUserSession,
};

export type {
  AdminSessionData,
  AdminSessionFlashData,
  UserSessionData,
  UserSessionFlashData,
};
