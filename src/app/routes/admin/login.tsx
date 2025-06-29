import { Form, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { AdminKV, AdminSessionKV } from "~/utils/kv";
import { redirect } from "react-router";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  
  if (!username || !password) {
    return { error: "ユーザー名とパスワードを入力してください" };
  }
  
  try {
    // 管理者を取得
    const admin = await AdminKV.getByUsername(env.USERS_KV, username);
    if (!admin) {
      return { error: "ユーザー名またはパスワードが正しくありません" };
    }
    
    // パスワード検証
    const passwordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + 'salt')
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    if (admin.passwordHash !== hashHex) {
      return { error: "ユーザー名またはパスワードが正しくありません" };
    }
    
    // セッション作成
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      adminId: admin.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7日間
    };
    
    await AdminSessionKV.set(env.USERS_KV, sessionId, session);
    
    // lastLogin更新
    await AdminKV.set(env.USERS_KV, admin.id, {
      ...admin,
      lastLogin: Date.now(),
    });
    
    // クッキー設定
    const headers = new Headers();
    headers.set("Set-Cookie", `admin-session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
    
    return redirect("/admin", { headers });
  } catch (error) {
    console.error("Admin login error:", error);
    return { error: "ログインに失敗しました。もう一度お試しください。" };
  }
}

export async function loader({ context }: { context: { cloudflare: { env: Env } } }) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  // 管理者が存在しない場合はセットアップページへ
  const adminCount = await AdminKV.count(env.USERS_KV);
  if (adminCount === 0) {
    return redirect("/admin/setup");
  }
  
  return null;
}

export default function AdminLogin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <h1>管理者ログイン</h1>
      
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
            style={{ 
              width: "100%", 
              padding: "0.5rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc" 
            }}
            disabled={isSubmitting}
          />
        </div>
        
        <div style={{ marginBottom: "2rem" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem" }}>
            パスワード:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            style={{ 
              width: "100%", 
              padding: "0.5rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc" 
            }}
            disabled={isSubmitting}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
      </Form>
    </div>
  );
}