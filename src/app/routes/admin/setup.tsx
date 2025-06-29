import { Form, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { AdminKV } from "~/utils/kv";
import { getAdminSession, commitAdminSession } from "~/utils/session.server";
import { redirect } from "react-router";

export async function action({ request, context }: ActionFunctionArgs) {
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
      'SHA-256',
      new TextEncoder().encode(password + 'salt')
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 管理者作成
    const adminId = crypto.randomUUID();
    const admin = {
      id: adminId,
      username,
      passwordHash: hashHex,
      createdAt: Date.now(),
    };

    await AdminKV.set(env.USERS_KV, adminId, admin);

    // 自動ログイン - React Routerセッションに管理者IDを保存
    session.set("adminId", adminId);

    return redirect("/admin", {
      headers: {
        "Set-Cookie": await commitAdminSession(session),
      },
    });
  } catch (error) {
    console.error("Admin setup error:", error);
    return { error: "セットアップに失敗しました。もう一度お試しください。" };
  }
}

export async function loader({ context }: { context: { cloudflare: { env: Env } } }) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  // 管理者が既に存在する場合はリダイレクト
  const adminCount = await AdminKV.count(env.USERS_KV);
  if (adminCount > 0) {
    return redirect("/admin/login");
  }

  return null;
}

export default function AdminSetup() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <h1>管理者初期設定</h1>
      <p>システムの初期管理者アカウントを作成してください。</p>

      <Form method="post" style={{ marginTop: "2rem" }}>
        {actionData?.error && (
          <div style={{
            color: "red",
            backgroundColor: "#ffebee",
            padding: "1rem",
            borderRadius: "4px",
            marginBottom: "1rem"
          }}>
            {actionData.error}
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="username" style={{ display: "block", marginBottom: "0.5rem" }}>
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
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
            disabled={isSubmitting}
          />
          <small style={{ color: "#666" }}>
            3〜30文字、英数字とアンダースコアのみ
          </small>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem" }}>
            パスワード:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
            disabled={isSubmitting}
          />
          <small style={{ color: "#666" }}>
            8文字以上
          </small>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "1rem",
            backgroundColor: isSubmitting ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            fontSize: "1rem",
          }}
        >
          {isSubmitting ? "作成中..." : "管理者アカウント作成"}
        </button>
      </Form>
    </div>
  );
}