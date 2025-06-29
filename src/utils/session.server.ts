import { createCookieSessionStorage } from "react-router";

type AdminSessionData = {
  adminId: string;
};

type AdminSessionFlashData = {
  error: string;
  success: string;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<AdminSessionData, AdminSessionFlashData>({
    cookie: {
      name: "__admin_session",
      httpOnly: true,
      // @ts-expect-error こいつのために@types/nodeを入れるのは別の問題を生みそう
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      secure: process?.env?.NODE_ENV !== "development", // 開発環境ではSecureフラグを無効化
      secrets: ["admin-secret-key"], // TODO: 環境変数から取得
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7日間
      path: "/",
    },
  });

export { getSession, commitSession, destroySession };

export type { AdminSessionData, AdminSessionFlashData };