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

export const loader = async ({ context }: LoaderFunctionArgs) => {
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
      await SystemKV.updateSettings(env.SYSTEM_KV, domains, "system");

      return { success: "システム設定を更新しました" };
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

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">システム設定</h1>
          <p className="text-gray-600 mt-2">
            ユーザーが設定可能なメールドメインを管理します
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

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">許可ドメイン設定</h2>
        <p className="text-gray-600 mb-6">
          ユーザーが設定可能なメールアドレスのドメインを制限します。
          空にすると全てのドメインが許可されます。
        </p>

        <Form method="post">
          {/* 隠しフィールドでドメインリストを送信 */}
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
            設定を更新
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

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              許可ドメイン数:
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {settings.allowedDomains.length === 0
                ? "制限なし"
                : `${settings.allowedDomains.length}個`}
            </p>
          </div>

          {settings.allowedDomains.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                許可ドメイン一覧:
              </h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <ul className="list-disc list-inside space-y-1">
                  {settings.allowedDomains.map((domain, index) => (
                    <li key={index} className="text-sm text-gray-700 font-mono">
                      {domain}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
