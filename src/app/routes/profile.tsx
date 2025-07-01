import { useLoaderData, useActionData, Form, redirect, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV } from "~/utils/kv";
import { validateEmailDomains } from "~/utils/domain-validation";
import SettingsNav from "../components/SettingsNav";
import LoadingButton from "../components/elements/LoadingButton";

const ProfileUpdateSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  managedEmails: z.string().min(1, "管理メールアドレスを入力してください"),
});

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  try {
    // セッションからユーザー情報を取得
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return redirect("/login");
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return redirect("/login");
    }

    // ユーザー詳細情報を取得
    const user = await UserKV.get(env.USERS_KV, kvSession.userId);
    if (!user) {
      return redirect("/login");
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        managedEmails: user.managedEmails,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    };
  } catch (error) {
    console.error("Failed to load profile:", error);
    throw new Error("プロフィールの読み込みに失敗しました");
  }
};

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
      email: formData.get("email") as string,
      managedEmails: formData.get("managedEmails") as string,
    };

    const validationResult = ProfileUpdateSchema.safeParse(rawData);
    if (!validationResult.success) {
      return {
        error: validationResult.error.errors[0].message,
        data: rawData
      };
    }

    const { email, managedEmails } = validationResult.data;

    // 管理メールアドレスをパース（改行またはカンマ区切り）
    const parsedManagedEmails = managedEmails
      .split(/[\n,]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    // 各メールアドレスの検証
    for (const managedEmail of parsedManagedEmails) {
      if (!z.string().email().safeParse(managedEmail).success) {
        return {
          error: `無効なメールアドレス: ${managedEmail}`,
          data: rawData
        };
      }
    }

    // 連絡先メールアドレスと管理メールアドレスの重複チェック
    if (parsedManagedEmails.includes(email)) {
      return {
        error: "連絡先メールアドレスは管理メールアドレスと重複できません",
        data: rawData
      };
    }

    // ドメイン検証（許可ドメインチェック）
    const domainValidation = await validateEmailDomains(parsedManagedEmails, env.SYSTEM_KV);
    if (!domainValidation.isValid) {
      return {
        error: domainValidation.message || "許可されていないドメインが含まれています",
        data: rawData
      };
    }

    // ユーザー情報を更新
    const updatedUser = {
      ...currentUser,
      email,
      managedEmails: parsedManagedEmails,
    };

    await UserKV.set(env.USERS_KV, currentUser.id, updatedUser);

    // セッション情報も更新
    const updatedSession = {
      ...kvSession,
      email,
      managedEmails: parsedManagedEmails,
    };

    await SessionKV.set(env.USERS_KV, sessionId, updatedSession);

    return { success: "プロフィールを更新しました" };

  } catch (error) {
    console.error("Failed to update profile:", error);
    return { error: "プロフィールの更新に失敗しました" };
  }
};

const Profile = () => {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ja-JP");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* モバイル用ナビゲーション */}
      <div className="lg:hidden mb-6">
        <SettingsNav />
      </div>
      <header className="mb-8 border-b border-gray-200 pb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">プロフィール</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* ユーザー情報表示 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">アカウント情報</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
                  <p className="text-gray-900 font-mono bg-white px-3 py-2 rounded border">
                    {user.username}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">※ユーザー名は変更できません</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">作成日</label>
                  <p className="text-gray-600">{formatDate(user.createdAt)}</p>
                </div>
                {user.lastLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">最終ログイン</label>
                    <p className="text-gray-600">{formatDate(user.lastLogin)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* プロフィール編集フォーム */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">プロフィール編集</h2>
              <Form method="post" className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    連絡先メールアドレス
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    defaultValue={actionData?.data?.email || user.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    システムからの通知を受信するメールアドレス
                  </p>
                </div>

                <div>
                  <label htmlFor="managedEmails" className="block text-sm font-medium text-gray-700 mb-1">
                    管理メールアドレス
                  </label>
                  <textarea
                    id="managedEmails"
                    name="managedEmails"
                    rows={4}
                    defaultValue={actionData?.data?.managedEmails || user.managedEmails.join('\n')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user1@example.com&#10;user2@example.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    実際にメールを受信・管理するアドレス（1行に1つ、またはカンマ区切り）
                  </p>
                </div>

                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="更新中..."
                  variant="primary"
                  size="medium"
                  className="w-full"
                >
                  プロフィールを更新
                </LoadingButton>
              </Form>
            </div>
          </div>

          {/* 管理メールアドレス一覧 */}
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              現在の管理メールアドレス ({user.managedEmails.length}件)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {user.managedEmails.map((email, index) => (
                <div
                  key={index}
                  className="px-3 py-2 bg-gray-50 rounded border font-mono text-sm"
                >
                  {email}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;