import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import { AdminKV } from "~/utils/kv";
import { redirect } from "react-router";
import type { Route } from "./+types/administrators";

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

  try {
    // 管理者一覧を取得
    const admins = await AdminKV.list(env.USERS_KV);

    // パスワードハッシュを除去してレスポンス
    const safeAdmins = admins.map((admin) => ({
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
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

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
};

export default () => {
  const { administrators, total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">管理者管理</h1>
          <p className="text-gray-600 mt-2">管理者数: {total}</p>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">新しい管理者追加</h2>
        <Form method="post">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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

            <div>
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
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`mt-4 px-6 py-3 text-white font-medium rounded-md text-base transition-all ${
              isSubmitting
                ? "bg-blue-400 cursor-not-allowed opacity-60"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            }`}
          >
            {isSubmitting ? "作成中..." : "管理者作成"}
          </button>
        </Form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-xl font-semibold p-6 pb-4">管理者一覧</h2>

        {administrators.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            管理者が登録されていません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    ユーザー名
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                    作成日
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
                {administrators.map((admin) => (
                  <tr key={admin.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {admin.username}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(admin.createdAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.lastLogin
                        ? new Date(admin.lastLogin).toLocaleDateString("ja-JP")
                        : "なし"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {total > 1 ? (
                        <Form method="delete" className="inline">
                          <input
                            type="hidden"
                            name="adminId"
                            value={admin.id}
                          />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            onClick={(e) => {
                              if (
                                !confirm(
                                  `管理者「${admin.username}」を削除しますか？この操作は取り消せません。`
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                              isSubmitting
                                ? "bg-red-400 text-white cursor-not-allowed opacity-60"
                                : "bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                            }`}
                          >
                            {isSubmitting ? "削除中..." : "削除"}
                          </button>
                        </Form>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          最後の管理者
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
