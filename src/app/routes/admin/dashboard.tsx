import { useLoaderData } from "react-router";
import { AdminKV, UserKV } from "~/utils/kv";
import type { Route } from "./+types/dashboard";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "管理者ダッシュボード - Cloudflare Mailbox" },
    {
      name: "description",
      content:
        "システム管理のダッシュボード - ユーザー管理、設定、バックアップ",
    },
  ];
};

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

  // 統計情報を取得（認証チェックはworkers/app.tsで実施済み）
  const [adminCount, userCount] = await Promise.all([
    AdminKV.count(env.USERS_KV),
    UserKV.count(env.USERS_KV),
  ]);

  return {
    stats: {
      adminCount,
      userCount,
    },
  };
};

export default () => {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
        <form method="post" action="/api/admin/logout">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer text-sm transition-colors hover:bg-red-700"
          >
            ログアウト
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <h3 className="m-0 mb-2 text-lg text-blue-600">管理者数</h3>
          <p className="m-0 text-2xl font-bold">{stats.adminCount}</p>
        </div>

        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <h3 className="m-0 mb-2 text-lg text-green-600">ユーザー数</h3>
          <p className="m-0 text-2xl font-bold">{stats.userCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/admin/users"
          className="block p-6 bg-white border border-gray-300 rounded-lg no-underline text-inherit transition-shadow hover:shadow-md hover:no-underline"
        >
          <h3 className="m-0 mb-2 text-xl">ユーザー管理</h3>
          <p className="m-0 text-gray-600 text-sm">
            ユーザーの一覧表示、削除、詳細確認
          </p>
        </a>

        <a
          href="/admin/invites"
          className="block p-6 bg-white border border-gray-300 rounded-lg no-underline text-inherit transition-shadow hover:shadow-md hover:no-underline"
        >
          <h3 className="m-0 mb-2 text-xl">招待管理</h3>
          <p className="m-0 text-gray-600 text-sm">
            招待URL生成、管理、使用状況確認
          </p>
        </a>

        <a
          href="/admin/administrators"
          className="block p-6 bg-white border border-gray-300 rounded-lg no-underline text-inherit transition-shadow hover:shadow-md hover:no-underline"
        >
          <h3 className="m-0 mb-2 text-xl">管理者管理</h3>
          <p className="m-0 text-gray-600 text-sm">
            管理者の追加、一覧表示、削除
          </p>
        </a>

        <a
          href="/admin/system-settings"
          className="block p-6 bg-white border border-gray-300 rounded-lg no-underline text-inherit transition-shadow hover:shadow-md hover:no-underline"
        >
          <h3 className="m-0 mb-2 text-xl">システム設定</h3>
          <p className="m-0 text-gray-600 text-sm">
            許可ドメインの管理、システム設定の変更
          </p>
        </a>

        <a
          href="/admin/backup"
          className="block p-6 bg-white border border-gray-300 rounded-lg no-underline text-inherit transition-shadow hover:shadow-md hover:no-underline"
        >
          <h3 className="m-0 mb-2 text-xl">バックアップ管理</h3>
          <p className="m-0 text-gray-600 text-sm">
            データバックアップ、復旧、世代管理
          </p>
        </a>
      </div>
    </div>
  );
};
