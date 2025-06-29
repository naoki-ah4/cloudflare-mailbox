import { Form, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { UserKV, SessionKV } from "~/utils/kv";
import { redirect } from "react-router";
import { getUserSession, commitUserSession } from "~/utils/session.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  const session = await getUserSession(request.headers.get("Cookie"));
  
  try {
    const formData = await request.formData();
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    
    if (!username || !password) {
      session.flash("error", "ユーザー名とパスワードを入力してください");
      return redirect("/login", {
        headers: {
          "Set-Cookie": await commitUserSession(session),
        },
      });
    }
    
    // ユーザーを取得
    const user = await UserKV.getByUsername(env.USERS_KV, username);
    if (!user) {
      session.flash("error", "ユーザー名またはパスワードが正しくありません");
      return redirect("/login", {
        headers: {
          "Set-Cookie": await commitUserSession(session),
        },
      });
    }
    
    // パスワード検証
    const passwordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + 'salt')
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    if (user.passwordHash !== hashHex) {
      session.flash("error", "ユーザー名またはパスワードが正しくありません");
      return redirect("/login", {
        headers: {
          "Set-Cookie": await commitUserSession(session),
        },
      });
    }
    
    // セッション作成（KVに保存）
    const sessionId = crypto.randomUUID();
    const kvSession = {
      id: sessionId,
      userId: user.id,
      email: user.email,
      managedEmails: user.managedEmails,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7日間
    };
    
    await SessionKV.set(env.USERS_KV, sessionId, kvSession);
    
    // lastLogin更新
    await UserKV.set(env.USERS_KV, user.id, {
      ...user,
      lastLogin: Date.now(),
    });
    
    // React RouterセッションにsessionIdを保存
    session.set("sessionId", sessionId);
    
    return redirect("/dashboard", {
      headers: {
        "Set-Cookie": await commitUserSession(session),
      },
    });
  } catch (error) {
    console.error("User login error:", error);
    session.flash("error", "ログインに失敗しました。もう一度お試しください。");
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitUserSession(session),
      },
    });
  }
}

export default function Login() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <h1>ログイン</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        メールボックス管理システムにログインしてください。
      </p>
      
      <Form method="post">
        
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
              padding: "0.75rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              fontSize: "1rem"
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
              padding: "0.75rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              fontSize: "1rem"
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
            marginBottom: "1rem"
          }}
        >
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
      </Form>
      
      <div style={{ 
        textAlign: "center", 
        padding: "1rem", 
        backgroundColor: "#f8f9fa",
        borderRadius: "4px",
        fontSize: "0.875rem",
        color: "#666"
      }}>
        アカウントをお持ちでない場合は、管理者から招待URLを受け取ってください。
      </div>
    </div>
  );
}