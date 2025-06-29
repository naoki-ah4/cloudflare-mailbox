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

const Login = () => {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ログイン</h1>
      <p className="text-gray-600 mb-8">
        メールボックス管理システムにログインしてください。
      </p>
      
      <Form method="post">
        
        <div className="mb-4">
          <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">
            ユーザー名:
          </label>
          <input
            type="text"
            id="username"
            name="username"
            required
            className="w-full px-3 py-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-8">
          <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
            パスワード:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className="w-full px-3 py-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            disabled={isSubmitting}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 bg-blue-600 text-white border-0 rounded text-base font-medium mb-4 transition-all ${
            isSubmitting 
              ? "cursor-not-allowed opacity-60" 
              : "cursor-pointer hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
      </Form>
      
      <div className="text-center p-4 bg-gray-50 rounded text-sm text-gray-600">
        アカウントをお持ちでない場合は、管理者から招待URLを受け取ってください。
      </div>
    </div>
  );
};

export default Login;