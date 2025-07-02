import { useActionData, Form, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV } from "~/utils/kv";
import { hashPassword, verifyPassword } from "~/utils/crypto";
import SettingsNav from "../../components/SettingsNav";
import LoadingButton from "../../components/elements/LoadingButton";

const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
    newPassword: z
      .string()
      .min(8, "新しいパスワードは8文字以上である必要があります"),
    confirmPassword: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "新しいパスワードと確認用パスワードが一致しません",
    path: ["confirmPassword"],
  });

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  try {
    // セッションからユーザー情報を取得
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return { error: "認証が必要です" };
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return { error: "セッションが無効です" };
    }

    // 現在のユーザー情報を取得
    const currentUser = await UserKV.get(env.USERS_KV, kvSession.userId);
    if (!currentUser) {
      return { error: "ユーザーが見つかりません" };
    }

    // フォームデータの検証
    const formData = await request.formData();
    const rawData = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const validationResult = PasswordChangeSchema.safeParse(rawData);
    if (!validationResult.success) {
      return {
        error: validationResult.error.errors[0].message,
        data: rawData,
      };
    }

    const { currentPassword, newPassword } = validationResult.data;

    // 現在のパスワードを検証
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      currentUser.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return {
        error: "現在のパスワードが正しくありません",
        data: rawData,
      };
    }

    // 新しいパスワードが現在のパスワードと同じでないかチェック
    if (currentPassword === newPassword) {
      return {
        error: "新しいパスワードは現在のパスワードと異なる必要があります",
        data: rawData,
      };
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await hashPassword(newPassword);

    // ユーザー情報を更新
    const updatedUser = {
      ...currentUser,
      passwordHash: newPasswordHash,
    };

    await UserKV.set(env.USERS_KV, currentUser.id, updatedUser);

    return { success: "パスワードを変更しました" };
  } catch (error) {
    console.error("Failed to change password:", error);
    return { error: "パスワードの変更に失敗しました" };
  }
};

const PasswordChange = () => {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* モバイル用ナビゲーション */}
      <div className="lg:hidden mb-6">
        <SettingsNav />
      </div>
      <header className="mb-8 border-b border-gray-200 pb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">パスワード変更</h1>
          <div className="flex gap-2">
            <a
              href="/dashboard"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 no-underline"
            >
              ダッシュボード
            </a>
          </div>
        </div>
      </header>

      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{actionData.error}</p>
        </div>
      )}

      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-700">{actionData.success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
        {/* デスクトップ用サイドバーナビゲーション */}
        <div className="hidden lg:block lg:col-span-1">
          <SettingsNav />
        </div>

        {/* メインコンテンツ */}
        <div className="lg:col-span-3">
          <div className="max-w-lg bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                パスワードを変更
              </h2>
              <p className="text-gray-600 text-sm">
                セキュリティのため、現在のパスワードの入力が必要です。
              </p>
            </div>

            <Form method="post" className="space-y-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  現在のパスワード
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  新しいパスワード
                </label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  8文字以上で入力してください
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  新しいパスワード（確認）
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="pt-4">
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="変更中..."
                  variant="primary"
                  size="medium"
                  className="w-full"
                >
                  パスワードを変更
                </LoadingButton>
              </div>
            </Form>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              セキュリティに関する注意
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• 強力なパスワードを使用してください</li>
              <li>• 他のサービスと同じパスワードは使用しないでください</li>
              <li>• 定期的にパスワードを変更することをお勧めします</li>
              <li>• パスワードを第三者と共有しないでください</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;
