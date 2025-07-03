import { useLoaderData } from "react-router";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV, InboxKV } from "~/utils/kv";
import type { Route } from "./+types/dashboard";

export const loader = async ({
  request,
  context: {
    cloudflare: { env },
  },
}: Route.LoaderArgs) => {
  try {
    // セッションからユーザー情報を取得
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      throw new Error("認証が必要です");
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      throw new Error("セッションが無効です");
    }

    // ユーザー詳細情報を取得
    const user = await UserKV.get(env.USERS_KV, kvSession.userId);
    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    // 各メールボックスの統計情報を並列取得
    const statsPromises = kvSession.managedEmails.map(async (email) => {
      const messages = await InboxKV.get(env.MAILBOXES_KV, email);
      const unreadCount = messages.filter((msg) => !msg.isRead).length;
      return {
        email,
        total: messages.length,
        unread: unreadCount,
      };
    });

    const mailboxStats = await Promise.all(statsPromises);

    // 統計情報を集計
    const totalMessages = mailboxStats.reduce(
      (sum, stat) => sum + stat.total,
      0
    );
    const unreadMessages = mailboxStats.reduce(
      (sum, stat) => sum + stat.unread,
      0
    );

    return {
      user: {
        username: user.username,
        email: user.email,
        managedEmails: user.managedEmails,
      },
      stats: {
        totalMessages,
        unreadMessages,
      },
      mailboxStats, // 各メールボックス別の詳細統計
    };
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    throw new Error("ダッシュボードの読み込みに失敗しました");
  }
};

const Dashboard = () => {
  const { user, stats, mailboxStats } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 border-b border-gray-200 pb-4 gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">メールボックス</h1>
          <p className="mt-2 text-gray-600">ようこそ、{user.username}さん</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:w-auto">
          <a
            href="/profile"
            className="px-4 py-2 bg-blue-600 text-white no-underline rounded hover:bg-blue-700 transition-colors"
          >
            プロフィール
          </a>
          <form method="post" action="/api/logout">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white border-0 rounded cursor-pointer hover:bg-red-700 transition-colors"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 md:mb-8">
        <div className="p-4 md:p-6 bg-gray-50 rounded-lg text-center">
          <h3 className="mb-2 text-blue-600 font-semibold text-sm md:text-base">
            総メール数
          </h3>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">
            {stats.totalMessages}
          </p>
        </div>

        <div className="p-4 md:p-6 bg-gray-50 rounded-lg text-center">
          <h3 className="mb-2 text-red-600 font-semibold text-sm md:text-base">
            未読メール
          </h3>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">
            {stats.unreadMessages}
          </p>
        </div>

        <div className="p-4 md:p-6 bg-gray-50 rounded-lg text-center sm:col-span-2 md:col-span-1">
          <h3 className="mb-2 text-green-600 font-semibold text-sm md:text-base">
            管理メールボックス
          </h3>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">
            {user.managedEmails.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          管理中のメールアドレス
        </h2>
        <div className="flex flex-col gap-3">
          {mailboxStats.map((stat) => (
            <div
              key={stat.email}
              className="p-4 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0"
            >
              <div>
                <strong className="text-base text-gray-900">
                  {stat.email}
                </strong>
              </div>
              <div className="flex gap-4 text-sm text-gray-600 self-start sm:self-auto">
                <span>
                  総数: <strong className="text-gray-900">{stat.total}</strong>
                </span>
                <span>
                  未読:{" "}
                  <strong
                    className={
                      stat.unread > 0 ? "text-red-600" : "text-green-600"
                    }
                  >
                    {stat.unread}
                  </strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 md:mt-8 text-center p-6 md:p-8 bg-blue-600 rounded-lg text-white">
        <h3 className="text-lg md:text-xl font-semibold mb-4">メール閲覧</h3>
        <p className="mb-4 md:mb-6 text-sm md:text-base">
          メールの閲覧・管理を行えます。
        </p>
        <a
          href="/messages"
          className="inline-block px-6 py-3 bg-white text-blue-600 no-underline rounded font-bold hover:bg-gray-50 transition-colors"
        >
          メール一覧を開く
        </a>
      </div>
    </div>
  );
};

export default Dashboard;
