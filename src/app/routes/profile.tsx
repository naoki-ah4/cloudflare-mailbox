import {
  useLoaderData,
  useActionData,
  Form,
  redirect,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/profile";
import { z } from "zod";
import { useState } from "react";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV } from "~/utils/kv";
import { SystemKV } from "~/utils/kv/system";
import { validateEmailDomains } from "~/utils/domain-validation";
import SettingsNav from "../components/SettingsNav";
import LoadingButton from "../components/elements/LoadingButton";

const ProfileUpdateSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  managedEmails: z.string().min(1, "管理メールアドレスを入力してください"),
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

    // ユーザー詳細情報と許可ドメインを並列取得
    const [user, systemSettings] = await Promise.all([
      UserKV.get(env.USERS_KV, kvSession.userId),
      SystemKV.getSettings(env.SYSTEM_KV),
    ]);

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
      allowedDomains: systemSettings?.allowedDomains || [],
      hasEmailRestriction:
        (systemSettings?.allowedEmailAddresses?.length || 0) > 0,
    };
  } catch (error) {
    console.error("Failed to load profile:", error);
    throw new Error("プロフィールの読み込みに失敗しました");
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
        data: rawData,
      };
    }

    const { email, managedEmails } = validationResult.data;

    // 管理メールアドレスをパース（改行またはカンマ区切り）
    const parsedManagedEmails = managedEmails
      .split(/[\n,]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    // 各メールアドレスの検証
    for (const managedEmail of parsedManagedEmails) {
      if (!z.string().email().safeParse(managedEmail).success) {
        return {
          error: `無効なメールアドレス: ${managedEmail}`,
          data: rawData,
        };
      }
    }

    // 連絡先メールアドレスと管理メールアドレスの重複チェック
    if (parsedManagedEmails.includes(email)) {
      return {
        error: "連絡先メールアドレスは管理メールアドレスと重複できません",
        data: rawData,
      };
    }

    // ドメイン検証（許可ドメインチェック）
    const domainValidation = await validateEmailDomains(
      parsedManagedEmails,
      env.SYSTEM_KV
    );
    if (!domainValidation.isValid) {
      return {
        error:
          domainValidation.message ||
          "許可されていないドメインが含まれています",
        data: rawData,
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

    // 受信可能性をチェックして警告を追加
    const emailSystemSettings = await SystemKV.getSettings(env.SYSTEM_KV);
    let warningMessage = "";

    if (
      emailSystemSettings &&
      emailSystemSettings.allowedEmailAddresses.length > 0
    ) {
      const unreceivableEmails = parsedManagedEmails.filter(
        (email) =>
          !emailSystemSettings.allowedEmailAddresses.includes(
            email.toLowerCase()
          )
      );

      if (unreceivableEmails.length > 0) {
        warningMessage = `⚠️ 注意: 以下のメールアドレスは受信制限により実際にメールを受信できません: ${unreceivableEmails.join(", ")}`;
      }
    }

    return {
      success: warningMessage
        ? `プロフィールを更新しました。${warningMessage}`
        : "プロフィールを更新しました",
    };
  } catch (error) {
    console.error("Failed to update profile:", error);
    return { error: "プロフィールの更新に失敗しました" };
  }
};

const Profile = () => {
  const { user, allowedDomains } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  // 管理メールアドレスの状態管理
  const [managedEmails, setManagedEmails] = useState<string[]>(
    user.managedEmails
  );
  const [newEmailLocal, setNewEmailLocal] = useState("");
  const [newEmailDomain, setNewEmailDomain] = useState(allowedDomains[0] || "");

  // メールアドレス追加
  const addEmail = () => {
    const localPart = newEmailLocal.trim();
    if (!localPart || !newEmailDomain) return;

    const fullEmail = `${localPart}@${newEmailDomain}`;

    // 重複チェック
    if (managedEmails.includes(fullEmail)) {
      alert("このメールアドレスは既に追加されています");
      return;
    }

    setManagedEmails([...managedEmails, fullEmail]);
    setNewEmailLocal("");
  };

  // メールアドレス削除
  const removeEmail = (index: number) => {
    setManagedEmails(managedEmails.filter((_, i) => i !== index));
  };

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
          <div className="space-y-12">
            {/* ユーザー情報表示 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                アカウント情報
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ユーザー名
                  </label>
                  <p className="text-gray-900 font-mono bg-white px-3 py-2 rounded border">
                    {user.username}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ※ユーザー名は変更できません
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    作成日
                  </label>
                  <p className="text-gray-600">{formatDate(user.createdAt)}</p>
                </div>
                {user.lastLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      最終ログイン
                    </label>
                    <p className="text-gray-600">
                      {formatDate(user.lastLogin)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* プロフィール編集フォーム */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                プロフィール編集
              </h2>
              <Form method="post" className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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

                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="更新中..."
                  variant="primary"
                  size="medium"
                  className="w-full"
                >
                  連絡先メールアドレスを更新
                </LoadingButton>
              </Form>
            </div>

            {/* 管理メールアドレス設定 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                管理メールアドレス設定
              </h2>
              <Form method="post">
                {/* 隠しフィールド */}
                <input type="hidden" name="email" value={user.email} />
                <input
                  type="hidden"
                  name="managedEmails"
                  value={managedEmails.join("\n")}
                />

                <div className="space-y-6">
                  {/* メールアドレス追加UI */}
                  {allowedDomains.length > 0 ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        新しいメールアドレスを追加
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            ユーザー名
                          </label>
                          <input
                            type="text"
                            value={newEmailLocal}
                            onChange={(e) => setNewEmailLocal(e.target.value)}
                            placeholder="username"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isSubmitting}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addEmail();
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            ドメイン
                          </label>
                          <select
                            value={newEmailDomain}
                            onChange={(e) => setNewEmailDomain(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isSubmitting}
                          >
                            {allowedDomains.map((domain) => (
                              <option key={domain} value={domain}>
                                {domain}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-sm text-gray-600">
                            プレビュー:{" "}
                            <span className="font-mono">
                              {newEmailLocal || "username"}@{newEmailDomain}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={addEmail}
                            disabled={isSubmitting || !newEmailLocal.trim()}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600 mb-3">
                        管理者がドメイン制限を設定していないため、任意のメールアドレスを入力できます。
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newEmailLocal}
                          onChange={(e) => setNewEmailLocal(e.target.value)}
                          placeholder="user@example.com"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isSubmitting}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newEmailLocal.includes("@")) {
                                const fullEmail = newEmailLocal.trim();
                                if (!managedEmails.includes(fullEmail)) {
                                  setManagedEmails([
                                    ...managedEmails,
                                    fullEmail,
                                  ]);
                                  setNewEmailLocal("");
                                }
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const fullEmail = newEmailLocal.trim();
                            if (
                              fullEmail.includes("@") &&
                              !managedEmails.includes(fullEmail)
                            ) {
                              setManagedEmails([...managedEmails, fullEmail]);
                              setNewEmailLocal("");
                            }
                          }}
                          disabled={
                            isSubmitting ||
                            !newEmailLocal.trim() ||
                            !newEmailLocal.includes("@")
                          }
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 現在のメールアドレス一覧 */}
                  {managedEmails.length > 0 ? (
                    <div>
                      <h3 className="text-md font-medium text-gray-700 mb-3">
                        現在の管理メールアドレス ({managedEmails.length}個)
                      </h3>
                      <div className="space-y-2">
                        {managedEmails.map((email, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded border"
                          >
                            <span className="font-mono text-sm">{email}</span>
                            <button
                              type="button"
                              onClick={() => removeEmail(index)}
                              disabled={
                                isSubmitting || managedEmails.length <= 1
                              }
                              className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm px-2 py-1"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 p-4 rounded-md">
                      <p className="text-sm text-red-600">
                        管理メールアドレスが設定されていません。最低1つのメールアドレスが必要です。
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <LoadingButton
                      type="submit"
                      loading={isSubmitting}
                      loadingText="更新中..."
                      variant="primary"
                      size="medium"
                      className="w-full"
                      disabled={managedEmails.length === 0}
                    >
                      管理メールアドレスを更新
                    </LoadingButton>
                    <p className="text-xs text-gray-500 mt-2">
                      実際にメールを受信・管理するアドレスです
                    </p>
                  </div>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
