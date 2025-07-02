import { Form, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { AdminKV, AdminSessionKV } from "~/utils/kv";
import { getAdminSession, commitAdminSession } from "~/utils/session.server";
import { redirect } from "react-router";
import LoadingButton from "~/app/components/elements/LoadingButton";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  const session = await getAdminSession(request.headers.get("Cookie"));

  // 管理者が既に存在するかチェック
  const adminCount = await AdminKV.count(env.USERS_KV);
  if (adminCount > 0) {
    return { error: "セットアップは既に完了しています" };
  }

  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  // バリデーション
  if (!username || !password) {
    return { error: "ユーザー名とパスワードは必須です" };
  }

  if (username.length < 3 || username.length > 30) {
    return { error: "ユーザー名は3〜30文字で入力してください" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "ユーザー名は英数字とアンダースコアのみ使用できます" };
  }

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  try {
    // パスワードハッシュ化（本来はbcryptを使用）
    const passwordHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password + "salt")
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 管理者作成
    const adminId = crypto.randomUUID();
    const admin = {
      id: adminId,
      username,
      passwordHash: hashHex,
      createdAt: Date.now(),
    };

    await AdminKV.set(env.USERS_KV, adminId, admin);

    // 自動ログイン - セッション作成（KVに保存）
    const sessionId = crypto.randomUUID();
    const kvSession = {
      id: sessionId,
      adminId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日間
    };

    await AdminSessionKV.set(env.USERS_KV, sessionId, kvSession);

    // React RouterセッションにsessionIdを保存
    session.set("sessionId", sessionId);

    return redirect("/admin", {
      headers: {
        "Set-Cookie": await commitAdminSession(session),
      },
    });
  } catch (error) {
    console.error("Admin setup error:", error);
    return { error: "セットアップに失敗しました。もう一度お試しください。" };
  }
};

export const loader = async ({
  context,
}: {
  context: { cloudflare: { env: Env } };
}) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  // 管理者が既に存在する場合はリダイレクト
  const adminCount = await AdminKV.count(env.USERS_KV);
  if (adminCount > 0) {
    return redirect("/admin/login");
  }

  return null;
};

export default () => {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">管理者初期設定</h1>
      <p className="text-gray-600 mb-8">
        システムの初期管理者アカウントを作成してください。
      </p>

      <Form method="post">
        {actionData?.error && (
          <div className="text-red-600 bg-red-50 p-4 rounded-md mb-4">
            {actionData.error}
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            ユーザー名:
          </label>
          <input
            type="text"
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">
            3〜30文字、英数字とアンダースコアのみ
          </small>
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            パスワード:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">8文字以上</small>
        </div>

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="作成中..."
          variant="primary"
          size="large"
          className="w-full"
        >
          管理者アカウント作成
        </LoadingButton>
      </Form>
    </div>
  );
};
