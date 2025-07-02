import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { SystemKV } from "~/utils/kv/system";
import LoadingButton from "~/app/components/elements/LoadingButton";
import type { SystemSettings } from "~/utils/kv/schema";

export const loader = async ({
  context,
}: LoaderFunctionArgs): Promise<{ settings: SystemSettings }> => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  try {
    // システム設定を取得（認証チェックはworkers/app.tsで実施済み）
    const settings = await SystemKV.getSettings(env.SYSTEM_KV);

    return {
      settings: settings || (await SystemKV.getDefaultSettings()),
    };
  } catch (error) {
    console.error("Failed to get system settings:", error);
    throw new Error("システム設定の取得に失敗しました");
  }
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const action = formData.get("action") as string;

      if (action === "update-domains") {
        const domainsText = formData.get("domains") as string;

        // ドメインリストを解析
        const domains = domainsText
          .split("\n")
          .map((d) => d.trim())
          .filter((d) => d.length > 0);

        // ドメイン形式の簡易バリデーション
        for (const domain of domains) {
          if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
            return { error: `無効なドメイン形式です: ${domain}` };
          }
        }

        // システム設定を更新（管理者IDは仮でsystemを使用）
        await SystemKV.updateSettings(
          env.SYSTEM_KV,
          { allowedDomains: domains },
          "system"
        );

        return { success: "ドメイン設定を更新しました" };
      } else if (action === "update-emails") {
        const emailsText = formData.get("emails") as string;
        const handlingMode = formData.get("handlingMode") as string;
        const catchAllEmail = formData.get("catchAllEmail") as string;

        // メールアドレスリストを解析
        const emails = emailsText
          .split("\n")
          .map((e) => e.trim())
          .filter((e) => e.length > 0);

        // メールアドレス形式の簡易バリデーション
        for (const email of emails) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { error: `無効なメールアドレス形式です: ${email}` };
          }
        }

        // CATCH_ALL設定時のバリデーション
        if (handlingMode === "CATCH_ALL") {
          if (!catchAllEmail) {
            return { error: "catch-all転送設定時は転送先アドレスが必須です" };
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(catchAllEmail)) {
            return { error: "無効なcatch-all転送先アドレス形式です" };
          }
        }

        // システム設定を更新（管理者IDは仮でsystemを使用）
        await SystemKV.updateSettings(
          env.SYSTEM_KV,
          {
            allowedEmailAddresses: emails,
            unauthorizedEmailHandling: handlingMode as "REJECT" | "CATCH_ALL",
            catchAllEmailAddress:
              handlingMode === "CATCH_ALL" ? catchAllEmail : undefined,
          },
          "system"
        );

        return { success: "受信可能メールアドレス設定を更新しました" };
      }

      return { error: "無効なアクションです" };
    } catch (error) {
      console.error("Failed to update system settings:", error);
      return { error: "システム設定の更新に失敗しました" };
    }
  }

  return { error: "許可されていないメソッドです" };
};

export default () => {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // ドメインリストの状態管理
  const [domains, setDomains] = useState<string[]>(settings.allowedDomains);
  const [newDomain, setNewDomain] = useState("");

  // 受信可能メールアドレスリストの状態管理
  const [emails, setEmails] = useState<string[]>(
    settings.allowedEmailAddresses
  );
  const [newEmail, setNewEmail] = useState("");

  // 未許可メール処理方式の状態管理
  const [handlingMode, setHandlingMode] = useState<"REJECT" | "CATCH_ALL">(
    settings.unauthorizedEmailHandling
  );
  const [catchAllEmail, setCatchAllEmail] = useState<string>(
    settings.catchAllEmailAddress || ""
  );

  // ドメイン追加
  const addDomain = () => {
    const trimmedDomain = newDomain.trim();
    if (trimmedDomain && !domains.includes(trimmedDomain)) {
      // 簡易ドメイン形式チェック
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedDomain)) {
        alert("無効なドメイン形式です");
        return;
      }
      setDomains([...domains, trimmedDomain]);
      setNewDomain("");
    }
  };

  // ドメイン削除
  const removeDomain = (index: number) => {
    setDomains(domains.filter((_, i) => i !== index));
  };

  // メールアドレス追加
  const addEmail = () => {
    const trimmedEmail = newEmail.trim();
    if (trimmedEmail && !emails.includes(trimmedEmail)) {
      // 簡易メールアドレス形式チェック
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        alert("無効なメールアドレス形式です");
        return;
      }
      setEmails([...emails, trimmedEmail]);
      setNewEmail("");
    }
  };

  // メールアドレス削除
  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">システム設定</h1>
          <p className="text-gray-600 mt-2">
            メール受信とユーザー登録の制限を管理します
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

      {actionData?.success && (
        <div className="text-green-600 bg-green-50 p-4 rounded-md mb-4">
          {actionData.success}
        </div>
      )}

      {/* 受信可能メールアドレス設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          受信可能メールアドレス設定
        </h2>
        <p className="text-gray-600 mb-6">
          システムで受信を許可するメールアドレスを制限します。
          空にすると全てのアドレスにメールを受信します。
        </p>

        <Form method="post">
          {/* 隠しフィールドでメールアドレスリストを送信 */}
          <input type="hidden" name="action" value="update-emails" />
          <input type="hidden" name="emails" value={emails.join("\n")} />
          <input type="hidden" name="handlingMode" value={handlingMode} />
          <input type="hidden" name="catchAllEmail" value={catchAllEmail} />

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              受信可能メールアドレス:
            </label>

            {/* メールアドレス追加UI */}
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <button
                type="button"
                onClick={addEmail}
                disabled={isSubmitting || !newEmail.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                追加
              </button>
            </div>

            {/* メールアドレスリスト表示 */}
            {emails.length > 0 ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600 mb-3">
                  受信可能メールアドレス ({emails.length}個):
                </p>
                <div className="space-y-2">
                  {emails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-2 rounded border"
                    >
                      <span className="font-mono text-sm">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        disabled={isSubmitting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm px-2 py-1"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">
                  受信可能メールアドレスが設定されていません。全てのアドレスにメールを受信します。
                </p>
              </div>
            )}

            <small className="text-gray-500 text-sm block mt-2">
              例: user@example.com, support@company.jp など
            </small>
          </div>

          {/* 未許可メール処理方式設定 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              未許可メール処理方式:
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="handlingModeRadio"
                  value="REJECT"
                  checked={handlingMode === "REJECT"}
                  onChange={(e) =>
                    setHandlingMode(e.target.value as "REJECT" | "CATCH_ALL")
                  }
                  disabled={isSubmitting}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>拒否</strong> -
                  許可されていないアドレス宛のメールを受信しない
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="handlingModeRadio"
                  value="CATCH_ALL"
                  checked={handlingMode === "CATCH_ALL"}
                  onChange={(e) =>
                    setHandlingMode(e.target.value as "REJECT" | "CATCH_ALL")
                  }
                  disabled={isSubmitting}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>catch-all転送</strong> - 指定したメールボックスに転送
                </span>
              </label>
            </div>

            {/* catch-all転送先アドレス設定 */}
            {handlingMode === "CATCH_ALL" && (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  catch-all転送先アドレス:
                </label>
                <input
                  type="email"
                  value={catchAllEmail}
                  onChange={(e) => setCatchAllEmail(e.target.value)}
                  placeholder="catch-all@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                  required={handlingMode === "CATCH_ALL"}
                />
                <small className="text-gray-500 text-sm block mt-1">
                  許可されていないアドレス宛のメールがこのアドレスに転送されます
                </small>
              </div>
            )}
          </div>

          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="更新中..."
            variant="primary"
            size="medium"
          >
            受信アドレス設定を更新
          </LoadingButton>
        </Form>
      </div>

      {/* ユーザー登録ドメイン制限設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">ユーザー登録ドメイン制限</h2>
        <p className="text-gray-600 mb-6">
          ユーザーが設定可能なメールアドレスのドメインを制限します。
          空にすると全てのドメインが許可されます。
        </p>

        <Form method="post">
          {/* 隠しフィールドでドメインリストを送信 */}
          <input type="hidden" name="action" value="update-domains" />
          <input type="hidden" name="domains" value={domains.join("\n")} />

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              許可ドメイン設定:
            </label>

            {/* ドメイン追加UI */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDomain();
                  }
                }}
              />
              <button
                type="button"
                onClick={addDomain}
                disabled={isSubmitting || !newDomain.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                追加
              </button>
            </div>

            {/* ドメインリスト表示 */}
            {domains.length > 0 ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600 mb-3">
                  許可ドメイン ({domains.length}個):
                </p>
                <div className="space-y-2">
                  {domains.map((domain, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-2 rounded border"
                    >
                      <span className="font-mono text-sm">{domain}</span>
                      <button
                        type="button"
                        onClick={() => removeDomain(index)}
                        disabled={isSubmitting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm px-2 py-1"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">
                  ドメインが設定されていません。全てのドメインが許可されます。
                </p>
              </div>
            )}

            <small className="text-gray-500 text-sm block mt-2">
              例: example.com, company.jp など
            </small>
          </div>

          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="更新中..."
            variant="primary"
            size="medium"
          >
            ドメイン設定を更新
          </LoadingButton>
        </Form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">現在の設定</h2>
          <a
            href="/admin/system-settings/history"
            className="px-3 py-2 bg-gray-100 text-gray-700 no-underline rounded-md hover:bg-gray-200 transition-colors text-sm"
          >
            変更履歴を見る
          </a>
        </div>

        <div className="space-y-6">
          {/* 受信可能メールアドレス設定 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              受信可能メールアドレス:
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {settings.allowedEmailAddresses.length === 0
                ? "制限なし（全アドレス受信）"
                : `${settings.allowedEmailAddresses.length}個のアドレス`}
            </p>

            {settings.allowedEmailAddresses.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-md mt-2">
                <ul className="list-disc list-inside space-y-1">
                  {settings.allowedEmailAddresses.map(
                    (email: string, index: number) => (
                      <li
                        key={index}
                        className="text-sm text-gray-700 font-mono"
                      >
                        {email}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* 未許可メール処理方式 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              未許可メール処理方式:
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {settings.unauthorizedEmailHandling === "CATCH_ALL"
                ? "catch-all転送"
                : "拒否"}
            </p>

            {settings.unauthorizedEmailHandling === "CATCH_ALL" &&
              settings.catchAllEmailAddress && (
                <div className="bg-gray-50 p-3 rounded-md mt-2">
                  <p className="text-sm text-gray-600 mb-1">転送先アドレス:</p>
                  <p className="text-sm text-gray-700 font-mono">
                    {settings.catchAllEmailAddress}
                  </p>
                </div>
              )}
          </div>

          {/* ユーザー登録ドメイン制限 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              ユーザー登録ドメイン制限:
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {settings.allowedDomains.length === 0
                ? "制限なし"
                : `${settings.allowedDomains.length}個のドメイン`}
            </p>

            {settings.allowedDomains.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-md mt-2">
                <ul className="list-disc list-inside space-y-1">
                  {settings.allowedDomains.map((domain, index) => (
                    <li key={index} className="text-sm text-gray-700 font-mono">
                      {domain}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {settings.updatedAt > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                最終更新:
              </h3>
              <p className="text-sm text-gray-600">
                {new Date(settings.updatedAt).toLocaleString("ja-JP")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
