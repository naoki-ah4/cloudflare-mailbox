import {
  useLoaderData,
  useActionData,
  Form,
  redirect,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/settings._index";
import { z } from "zod";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV, SettingsKV } from "~/utils/kv";
import type { UserSettings } from "~/utils/kv/schema";
import SettingsNav from "../components/SettingsNav";
import { useTheme } from "~/app/utils/theme";
import LoadingButton from "../components/elements/LoadingButton";

const SettingsUpdateSchema = z.object({
  emailNotifications: z.string().transform((val) => val === "true"),
  theme: z.enum(["light", "dark", "auto"]),
  language: z.enum(["ja", "en"]),
  timezone: z.string(),
});

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

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

    // ユーザー情報を取得
    const user = await UserKV.get(env.USERS_KV, kvSession.userId);
    if (!user) {
      return redirect("/login");
    }

    // ユーザー設定を取得（存在しない場合はデフォルト値）
    let userSettings = await SettingsKV.get(env.MAILBOXES_KV, kvSession.userId);

    if (!userSettings) {
      // 初回アクセス時のデフォルト設定を作成
      const defaultSettings: UserSettings = {
        userId: kvSession.userId,
        emailNotifications: true,
        theme: "auto",
        language: "ja",
        timezone: "Asia/Tokyo",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await SettingsKV.set(env.MAILBOXES_KV, kvSession.userId, defaultSettings);
      userSettings = defaultSettings;
    }

    return {
      user: {
        username: user.username,
        email: user.email,
        managedEmails: user.managedEmails,
      },
      settings: userSettings,
    };
  } catch (error) {
    console.error("Failed to load settings:", error);
    throw new Error("設定の読み込みに失敗しました");
  }
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

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

    // フォームデータの検証
    const formData = await request.formData();
    const rawData = {
      emailNotifications: formData.get("emailNotifications") as string,
      theme: formData.get("theme") as string,
      language: formData.get("language") as string,
      timezone: formData.get("timezone") as string,
    };

    const validationResult = SettingsUpdateSchema.safeParse(rawData);
    if (!validationResult.success) {
      return {
        error: validationResult.error.errors[0].message,
        data: rawData,
      };
    }

    const { emailNotifications, theme, language, timezone } =
      validationResult.data;

    // 設定を更新
    const updatedSettings = await SettingsKV.update(
      env.MAILBOXES_KV,
      kvSession.userId,
      {
        emailNotifications,
        theme,
        language,
        timezone,
      }
    );

    if (!updatedSettings) {
      return { error: "設定の更新に失敗しました" };
    }

    return { success: "設定を保存しました" };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { error: "設定の保存に失敗しました" };
  }
};

const Settings = () => {
  const { user, settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { theme, setTheme } = useTheme(settings.theme);

  const isSubmitting = navigation.state === "submitting";

  const handleThemeChange = (newTheme: "light" | "dark" | "auto") => {
    setTheme(newTheme);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* モバイル用ナビゲーション */}
      <div className="lg:hidden mb-6">
        <SettingsNav />
      </div>
      <header className="mb-8 border-b border-gray-200 pb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
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
        <div className="lg:col-span-3 space-y-6">
          {/* アカウント情報 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              アカウント情報
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ユーザー名
                </label>
                <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
                  {user.username}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  連絡先メールアドレス
                </label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                管理メールアドレス ({user.managedEmails.length}件)
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {user.managedEmails.map((email, index) => (
                  <span
                    key={index}
                    className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 表示設定 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              表示設定
            </h2>
            <Form method="post" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="theme"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    テーマ
                  </label>
                  <select
                    id="theme"
                    name="theme"
                    value={theme}
                    onChange={(e) =>
                      handleThemeChange(
                        e.target.value as "light" | "dark" | "auto"
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="auto">システム設定に従う</option>
                    <option value="light">ライトモード</option>
                    <option value="dark">ダークモード</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="language"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    言語
                  </label>
                  <select
                    id="language"
                    name="language"
                    defaultValue={
                      actionData?.data?.language || settings.language
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="timezone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    タイムゾーン
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    defaultValue={
                      actionData?.data?.timezone || settings.timezone
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">
                      America/New_York (EST)
                    </option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>

              {/* 通知設定 */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-base font-medium text-gray-900 mb-3">
                  通知設定
                </h3>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    name="emailNotifications"
                    value="true"
                    defaultChecked={
                      actionData?.data?.emailNotifications === "true" ||
                      settings.emailNotifications
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <input type="hidden" name="theme" value={theme} />
                  <label
                    htmlFor="emailNotifications"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    重要なお知らせをメールで受信する
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  システムの重要な更新やセキュリティに関する通知を受信します
                </p>
              </div>

              <div className="pt-4">
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="保存中..."
                  variant="primary"
                  size="medium"
                >
                  設定を保存
                </LoadingButton>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
