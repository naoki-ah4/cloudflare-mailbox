import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { UserKV } from "~/utils/kv";
import { redirect } from "react-router";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // ユーザー一覧を取得
    const users = await UserKV.list(env.USERS_KV);
    
    // パスワードハッシュを除去してレスポンス
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      managedEmails: user.managedEmails,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));
    
    return {
      users: safeUsers,
      total: users.length,
    };
  } catch (error) {
    console.error("Failed to get users:", error);
    throw new Error("ユーザー一覧の取得に失敗しました");
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const userId = formData.get("userId") as string;
      
      if (!userId) {
        return { error: "ユーザーIDが必要です" };
      }
      
      // ユーザー存在確認
      const user = await UserKV.get(env.USERS_KV, userId);
      if (!user) {
        return { error: "ユーザーが見つかりません" };
      }
      
      // ユーザー削除
      await UserKV.delete(env.USERS_KV, userId);
      
      return redirect("/admin/users");
    } catch (error) {
      console.error("Failed to delete user:", error);
      return { error: "ユーザーの削除に失敗しました" };
    }
  }
  
  return { error: "許可されていないメソッドです" };
}

export default function AdminUsers() {
  const { users, total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting" && navigation.formMethod === "DELETE";

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
          <h1>ユーザー管理</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            登録ユーザー数: {total}
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

      {users.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          padding: "3rem", 
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          color: "#666"
        }}>
          登録されているユーザーはありません
        </div>
      ) : (
        <div style={{ 
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #dee2e6",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#f8f9fa" }}>
              <tr>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  ユーザー名
                </th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  連絡先メール
                </th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  管理メールアドレス数
                </th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>
                  登録日
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
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #f8f9fa" }}>
                  <td style={{ padding: "1rem", fontWeight: "500" }}>
                    {user.username}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {user.email}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {user.managedEmails.length}個
                  </td>
                  <td style={{ padding: "1rem", color: "#666" }}>
                    {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td style={{ padding: "1rem", color: "#666" }}>
                    {user.lastLogin 
                      ? new Date(user.lastLogin).toLocaleDateString('ja-JP')
                      : 'なし'
                    }
                  </td>
                  <td style={{ padding: "1rem", textAlign: "center" }}>
                    <Form method="delete" style={{ display: "inline" }}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={isDeleting}
                        onClick={(e) => {
                          if (!confirm(`ユーザー「${user.username}」を削除しますか？この操作は取り消せません。`)) {
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
                          cursor: isDeleting ? "not-allowed" : "pointer",
                          opacity: isDeleting ? 0.6 : 1,
                        }}
                      >
                        {isDeleting ? "削除中..." : "削除"}
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}