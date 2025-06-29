import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AdminKV } from "~/utils/kv";
import { redirect } from "react-router";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // 管理者一覧を取得
    const admins = await AdminKV.list(env.USERS_KV);
    
    // パスワードハッシュを除去してレスポンス
    const safeAdmins = admins.map(admin => ({
      id: admin.id,
      username: admin.username,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin,
    }));
    
    return {
      administrators: safeAdmins,
      total: admins.length,
    };
  } catch (error) {
    console.error("Failed to get administrators:", error);
    throw new Error("管理者一覧の取得に失敗しました");
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method === "POST") {
    try {
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
      
      // ユーザー名重複チェック
      const existingAdmin = await AdminKV.getByUsername(env.USERS_KV, username);
      if (existingAdmin) {
        return { error: "そのユーザー名は既に使用されています" };
      }
      
      // パスワードハッシュ化
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
      
      return redirect("/admin/administrators");
    } catch (error) {
      console.error("Failed to create administrator:", error);
      return { error: "管理者の作成に失敗しました" };
    }
  }
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const adminId = formData.get("adminId") as string;
      
      if (!adminId) {
        return { error: "管理者IDが必要です" };
      }
      
      // 管理者数チェック（最後の管理者は削除不可）
      const adminCount = await AdminKV.count(env.USERS_KV);
      if (adminCount <= 1) {
        return { error: "最後の管理者は削除できません" };
      }
      
      // 管理者存在確認
      const admin = await AdminKV.get(env.USERS_KV, adminId);
      if (!admin) {
        return { error: "管理者が見つかりません" };
      }
      
      // 管理者削除
      await AdminKV.delete(env.USERS_KV, adminId);
      
      return redirect("/admin/administrators");
    } catch (error) {
      console.error("Failed to delete administrator:", error);
      return { error: "管理者の削除に失敗しました" };
    }
  }
  
  return { error: "許可されていないメソッドです" };
}

export default function AdminAdministrators() {
  const { administrators, total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "2rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "1rem"
      }}>
        <div>
          <h1>管理者管理</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            管理者数: {total}
          </p>
        </div>
        <a 
          href="/admin"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#6c757d",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          ダッシュボードに戻る
        </a>
      </header>

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

      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        padding: "1.5rem",
        marginBottom: "2rem"
      }}>
        <h2 style={{ margin: "0 0 1rem 0" }}>新しい管理者追加</h2>
        <Form method="post">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
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
            
            <div>
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
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "作成中..." : "管理者作成"}
          </button>
        </Form>
      </div>

      <div style={{ 
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        overflow: "hidden"
      }}>
        <h2 style={{ margin: "0", padding: "1.5rem 1.5rem 1rem 1.5rem" }}>管理者一覧</h2>
        
        {administrators.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "2rem", 
            color: "#666"
          }}>
            管理者が登録されていません
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#f8f9fa" }}>
              <tr>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  ユーザー名
                </th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  作成日
                </th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  最終ログイン
                </th>
                <th style={{ padding: "1rem", textAlign: "center", borderBottom: "1px solid #dee2e6" }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {administrators.map((admin) => (
                <tr key={admin.id} style={{ borderBottom: "1px solid #f8f9fa" }}>
                  <td style={{ padding: "1rem", fontWeight: "500" }}>
                    {admin.username}
                  </td>
                  <td style={{ padding: "1rem", color: "#666" }}>
                    {new Date(admin.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td style={{ padding: "1rem", color: "#666" }}>
                    {admin.lastLogin 
                      ? new Date(admin.lastLogin).toLocaleDateString('ja-JP')
                      : 'なし'
                    }
                  </td>
                  <td style={{ padding: "1rem", textAlign: "center" }}>
                    {total > 1 ? (
                      <Form method="delete" style={{ display: "inline" }}>
                        <input type="hidden" name="adminId" value={admin.id} />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          onClick={(e) => {
                            if (!confirm(`管理者「${admin.username}」を削除しますか？この操作は取り消せません。`)) {
                              e.preventDefault();
                            }
                          }}
                          style={{
                            padding: "0.25rem 0.75rem",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.875rem",
                            cursor: isSubmitting ? "not-allowed" : "pointer",
                            opacity: isSubmitting ? 0.6 : 1,
                          }}
                        >
                          {isSubmitting ? "削除中..." : "削除"}
                        </button>
                      </Form>
                    ) : (
                      <span style={{ color: "#666", fontSize: "0.875rem" }}>
                        最後の管理者
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}