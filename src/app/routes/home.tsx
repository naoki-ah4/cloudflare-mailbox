import type { Route } from "./+types/home";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "Cloudflare Mailbox - セキュアなメール管理システム" },
    {
      name: "description",
      content: "Cloudflare Workers上で動作するプライベートメール管理システム",
    },
  ];
};

export const loader = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context,
}: Route.LoaderArgs) => {
  return {};
};

const Home = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loaderData,
}: Route.ComponentProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="max-w-4xl bg-white rounded-2xl p-12 text-center shadow-xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            <span aria-hidden="true">📧</span> Cloudflare Mailbox
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Cloudflare Workers上で動作する
            <br />
            セキュアなプライベートメール管理システム
          </p>
        </div>

        {/* 特徴 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-4">
            <div className="text-3xl mb-2" aria-hidden="true">🔒</div>
            <h3 className="text-lg font-semibold mb-2">招待制アクセス</h3>
            <p className="text-sm text-gray-600">
              管理者による招待制で
              <br />
              セキュアなアクセス管理
            </p>
          </div>

          <div className="p-4">
            <div className="text-3xl mb-2" aria-hidden="true">⚡</div>
            <h3 className="text-lg font-semibold mb-2">高速・軽量</h3>
            <p className="text-sm text-gray-600">
              Cloudflare Workers
              <br />
              エッジでの高速処理
            </p>
          </div>

          <div className="p-4">
            <div className="text-3xl mb-2" aria-hidden="true">📱</div>
            <h3 className="text-lg font-semibold mb-2">マルチデバイス</h3>
            <p className="text-sm text-gray-600">
              デスクトップ・モバイル
              <br />
              どこからでもアクセス
            </p>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="/login"
            className="inline-block px-8 py-4 bg-indigo-500 text-white rounded-lg font-bold text-lg hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200"
          >
            ログイン
          </a>

          <a
            href="/signup"
            className="inline-block px-8 py-4 bg-transparent text-indigo-500 border-2 border-indigo-500 rounded-lg font-bold text-lg hover:bg-indigo-500 hover:text-white hover:-translate-y-1 transition-all duration-200"
          >
            招待コードで登録
          </a>
        </div>

        {/* フッター */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-400">
          <p>Powered by Cloudflare Workers, KV, R2</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
