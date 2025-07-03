import { Form, useNavigation } from "react-router";
import { AdminKV, AdminSessionKV } from "~/utils/kv";
import { redirect } from "react-router";
import { getAdminSession, commitAdminSession } from "~/utils/session.server";
import LoadingButton from "~/app/components/elements/LoadingButton";
import type { Route } from "./+types/login";
import { SafeFormData } from "~/app/utils/formdata";

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;
  const session = await getAdminSession(request.headers.get("Cookie"));

  const formData = SafeFormData.fromObject(await request.formData());
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) {
    session.flash("error", "ユーザー名とパスワードを入力してください");
    return redirect("/admin/login", {
      headers: {
        "Set-Cookie": await commitAdminSession(session),
      },
    });
  }

  try {
    // 管理者を取得
    const admin = await AdminKV.getByUsername(env.USERS_KV, username);
    if (!admin) {
      session.flash("error", "ユーザー名またはパスワードが正しくありません");
      return redirect("/admin/login", {
        headers: {
          "Set-Cookie": await commitAdminSession(session),
        },
      });
    }

    // パスワード検証
    const passwordHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password + "salt")
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (admin.passwordHash !== hashHex) {
      session.flash("error", "ユーザー名またはパスワードが正しくありません");
      return redirect("/admin/login", {
        headers: {
          "Set-Cookie": await commitAdminSession(session),
        },
      });
    }

    // セッション作成（KVに保存）
    const sessionId = crypto.randomUUID();
    const kvSession = {
      id: sessionId,
      adminId: admin.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日間
    };

    await AdminSessionKV.set(env.USERS_KV, sessionId, kvSession);

    // lastLogin更新
    await AdminKV.set(env.USERS_KV, admin.id, {
      ...admin,
      lastLogin: Date.now(),
    });

    // React RouterセッションにsessionIdを保存
    session.set("sessionId", sessionId);

    return redirect("/admin", {
      headers: {
        "Set-Cookie": await commitAdminSession(session),
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    session.flash("error", "ログインに失敗しました。もう一度お試しください。");
    return redirect("/admin/login", {
      headers: {
        "Set-Cookie": await commitAdminSession(session),
      },
    });
  }
};

export const loader = async ({
  context,
}: {
  context: { cloudflare: { env: Env } };
}) => {
  const { env } = context.cloudflare;

  // 管理者が存在しない場合はセットアップページへ
  const adminCount = await AdminKV.count(env.USERS_KV);
  if (adminCount === 0) {
    return redirect("/admin/setup");
  }

  return null;
};

export default () => {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">管理者ログイン</h1>

      <Form method="post">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-8">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
        </div>

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="ログイン中..."
          variant="primary"
          size="large"
          className="w-full"
        >
          ログイン
        </LoadingButton>
      </Form>
    </div>
  );
};
