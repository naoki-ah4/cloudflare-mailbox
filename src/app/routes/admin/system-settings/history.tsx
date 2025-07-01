import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { SystemKV } from "~/utils/kv/system";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // 履歴を取得（認証チェックはworkers/app.tsで実施済み）
    const history = await SystemKV.getHistory(env.SYSTEM_KV);
    
    return {
      history: history.reverse(), // 最新から順番に表示
    };
  } catch (error) {
    console.error("Failed to get system settings history:", error);
    throw new Error("システム設定履歴の取得に失敗しました");
  }
}

export default () => {
  const { history } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">システム設定変更履歴</h1>
          <p className="text-gray-600 mt-2">
            システム設定の変更履歴を表示します（全{history.length}件）
          </p>
        </div>
        <a 
          href="/admin/system-settings"
          className="px-4 py-2 bg-gray-500 text-white no-underline rounded-md hover:bg-gray-600 transition-colors"
        >
          設定画面に戻る
        </a>
      </header>

      {history.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-600">変更履歴がありません</p>
          <p className="text-sm text-gray-500 mt-2">
            システム設定を変更すると履歴が表示されます
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            {history.map((entry, index) => (
              <div key={index} className="border-l-4 border-blue-200 pl-6 py-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    {entry.changes}
                  </h3>
                  <span className="text-sm text-gray-500 font-mono">
                    {new Date(entry.updatedAt).toLocaleString('ja-JP')}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      管理者ID: 
                      <code className="bg-gray-100 px-2 py-1 rounded font-mono ml-2">
                        {entry.updatedBy}
                      </code>
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      設定内容:
                    </h4>
                    {entry.allowedDomains.length > 0 ? (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600 mb-2">
                          許可ドメイン ({entry.allowedDomains.length}個):
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {entry.allowedDomains.map((domain, domainIndex) => (
                            <li key={domainIndex} className="text-sm text-gray-700 font-mono">
                              {domain}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600 italic">
                          制限なし（全てのドメインが許可）
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {index < history.length - 1 && (
                  <hr className="mt-6 border-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}