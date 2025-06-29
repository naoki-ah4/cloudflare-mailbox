import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { UserKV } from "~/utils/kv";
import { redirect } from "react-router";

export const loader = async ({ context }: LoaderFunctionArgs) => {
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

export const action = async ({ request, context }: ActionFunctionArgs) => {
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

export default () => {
  const { users, total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting" && navigation.formMethod === "DELETE";

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <p className="text-gray-600 mt-2">
            登録ユーザー数: {total}
          </p>
        </div>
        <a 
          href="/admin"
          className="px-4 py-2 bg-gray-500 text-white no-underline rounded-md hover:bg-gray-600 transition-colors"
        >
          ダッシュボードに戻る
        </a>
      </header>

      {actionData?.error && (
        <div className="text-red-600 bg-red-50 p-4 rounded-md mb-4">
          {actionData.error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-600">
          登録されているユーザーはありません
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    ユーザー名
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    連絡先メール
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    管理メールアドレス数
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    登録日
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    最終ログイン
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border-b border-gray-200">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.managedEmails.length}個
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.lastLogin 
                        ? new Date(user.lastLogin).toLocaleDateString('ja-JP')
                        : 'なし'
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Form method="delete" className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          disabled={isDeleting}
                          onClick={(e) => {
                            if (!confirm(`ユーザー「${user.username}」を削除しますか？この操作は取り消せません。`)) {
                              e.preventDefault();
                            }
                          }}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                            isDeleting 
                              ? "bg-red-400 text-white cursor-not-allowed opacity-60" 
                              : "bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                          }`}
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
        </div>
      )}
    </div>
  );
}