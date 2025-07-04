import { useLoaderData, useSearchParams, useNavigation } from "react-router";
import type { Route } from "./+types/messages";
import { SessionKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import type { EmailMetadata } from "~/utils/schema";
import { sanitizeEmailText, sanitizeSearchQuery } from "~/utils/sanitize";
import Pagination from "../components/Pagination";
import { useState } from "react";
import { SkeletonMessageItem } from "../components/elements/SkeletonLoader";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "メール一覧 - Cloudflare Mailbox" },
    {
      name: "description",
      content: "受信メールの一覧表示と管理",
    },
  ];
};

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

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

    const url = new URL(request.url);
    const selectedMailbox = url.searchParams.get("mailbox");
    const searchQuery = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const itemsPerPage = 50; // 1ページあたりのアイテム数

    // サイドバー用統計情報を並列取得（効率化）
    const mailboxStats = await InboxKV.getMultipleStats(
      env.MAILBOXES_KV,
      kvSession.managedEmails
    );

    // メールボックス取得
    let allMessages: (EmailMetadata & { mailbox: string })[] = [];

    if (selectedMailbox) {
      // 特定のメールボックスのみ
      if (kvSession.managedEmails.includes(selectedMailbox)) {
        const messages = await InboxKV.get(env.MAILBOXES_KV, selectedMailbox);
        allMessages = messages.map((msg) => ({
          ...msg,
          mailbox: selectedMailbox,
        }));
      }
    } else {
      // 全メールボックス統合（並列処理で効率化）
      const messagePromises = kvSession.managedEmails.map(async (email) => {
        const messages = await InboxKV.get(env.MAILBOXES_KV, email);
        return messages.map((msg) => ({ ...msg, mailbox: email }));
      });

      const messagesArrays = await Promise.all(messagePromises);
      allMessages = messagesArrays.flat();

      // 日付順ソート（新しい順）
      allMessages.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    // 検索フィルタ
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allMessages = allMessages.filter(
        (msg) =>
          msg.subject.toLowerCase().includes(query) ||
          msg.from.toLowerCase().includes(query)
      );
    }

    // 統計計算（ページネーション前の全体）
    const totalMessages = allMessages.length;
    const unreadMessages = allMessages.filter((msg) => !msg.isRead).length;

    // ページネーション処理
    const totalPages = Math.ceil(totalMessages / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1)); // ページ番号を有効範囲に制限

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);

    return {
      messages: paginatedMessages,
      managedEmails: kvSession.managedEmails,
      selectedMailbox,
      searchQuery,
      pagination: {
        currentPage,
        totalPages,
        totalItems: totalMessages,
        itemsPerPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      stats: {
        totalMessages,
        unreadMessages,
      },
      mailboxStats, // 各メールボックス別統計
      user: {
        email: kvSession.email,
      },
    };
  } catch (error) {
    console.error("Failed to load messages:", error);
    throw new Error("メール一覧の取得に失敗しました");
  }
};

const Messages = () => {
  const {
    messages,
    managedEmails,
    selectedMailbox,
    searchQuery,
    pagination,
    stats,
    mailboxStats,
    user,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigation = useNavigation();

  const isLoading = navigation.state === "loading";

  const handleMailboxChange = (mailbox: string) => {
    const params = new URLSearchParams(searchParams);
    if (mailbox === "all") {
      params.delete("mailbox");
    } else {
      params.set("mailbox", mailbox);
    }
    // メールボックス変更時は1ページ目に戻る
    params.delete("page");
    setSearchParams(params);
  };

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set("search", query);
    } else {
      params.delete("search");
    }
    // 検索時は1ページ目に戻る
    params.delete("page");
    setSearchParams(params);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen lg:flex-row max-lg:flex-col">
      {/* モバイル用サイドバーオーバーレイ */}
      <div
        className={`hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:bg-black/50 max-md:z-[999] ${sidebarOpen ? "max-md:block" : ""}`}
        onClick={closeSidebar}
      />

      {/* サイドバー */}
      <div
        className={`w-72 bg-gray-50 border-r border-gray-300 p-4 max-lg:w-full max-lg:border-r-0 max-lg:border-b max-lg:border-gray-300 max-md:hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen max-md:w-72 max-md:z-[1000] max-md:shadow-lg ${sidebarOpen ? "max-md:block" : ""}`}
      >
        {/* モバイル用閉じるボタン */}
        <button
          className="hidden max-md:block max-md:absolute max-md:top-4 max-md:right-4 max-md:bg-transparent max-md:border-none max-md:text-xl max-md:cursor-pointer max-md:text-gray-500 max-md:z-[1001]"
          onClick={closeSidebar}
        >
          ✕
        </button>

        <div className="mb-8">
          <h2 className="m-0 mb-2 text-xl">メールボックス</h2>
          <p className="m-0 text-sm text-gray-600">{user.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-3 bg-white border border-gray-300 rounded text-center">
            <p className="text-blue-600 m-0 mb-1 text-xl font-bold">
              {stats.totalMessages}
            </p>
            <h3 className="m-0 text-xs text-gray-600">総数</h3>
          </div>
          <div className="p-3 bg-white border border-gray-300 rounded text-center">
            <p className="text-red-600 m-0 mb-1 text-xl font-bold">
              {stats.unreadMessages}
            </p>
            <h3 className="m-0 text-xs text-gray-600">未読</h3>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="m-0 mb-3 text-base">フィルタ</h3>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleMailboxChange("all")}
              className={`p-3 rounded cursor-pointer transition-colors border text-left ${!selectedMailbox ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"}`}
            >
              <div className="font-bold text-sm">
                📥 すべて ({stats.totalMessages})
              </div>
            </button>

            {managedEmails.map((email) => {
              const emailStats = mailboxStats[email] || { total: 0, unread: 0 };

              return (
                <button
                  key={email}
                  onClick={() => handleMailboxChange(email)}
                  className={`w-full px-3 py-2 rounded text-left cursor-pointer mb-1 text-sm border ${
                    selectedMailbox === email
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-800 border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>📧 {email.split("@")[0]}</span>
                    <div className="flex gap-2 text-xs">
                      <span>({emailStats.total})</span>
                      {emailStats.unread > 0 && (
                        <span
                          className={`px-1 rounded ${
                            selectedMailbox === email
                              ? "bg-white text-blue-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {emailStats.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <a
            href="/dashboard"
            className="block p-3 bg-gray-500 text-white no-underline rounded text-center"
          >
            ダッシュボードに戻る
          </a>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 p-4 max-md:p-3">
        <header className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4 max-md:flex-col max-md:items-start max-md:gap-4">
          <div className="flex items-center gap-4">
            {/* モバイル用ハンバーガーメニューボタン */}
            <button
              className="hidden max-md:block bg-transparent border-none text-xl cursor-pointer p-2 text-gray-700"
              onClick={toggleSidebar}
            >
              ☰
            </button>
            <div>
              <h1 className="m-0 max-md:text-xl">
                {selectedMailbox ? `${selectedMailbox}` : "すべてのメール"}
              </h1>
              <p className="m-1 mt-1 text-gray-600 max-md:text-sm">
                {pagination.totalItems}件のメール（{pagination.currentPage}/
                {pagination.totalPages}ページ）
              </p>
            </div>
          </div>

          <form method="post" action="/api/logout">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer"
            >
              ログアウト
            </button>
          </form>
        </header>

        {/* 検索バー と 新規作成ボタン */}
        <div className="mb-6 flex gap-4 items-center">
          <input
            type="text"
            placeholder="件名または送信者で検索..."
            defaultValue={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const timeoutId = setTimeout(() => handleSearch(value), 300);
              return () => clearTimeout(timeoutId);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <a
            href="/compose"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap no-underline"
          >
            ✉️ 新規作成
          </a>
        </div>

        {/* メール一覧 */}
        {isLoading ? (
          <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonMessageItem key={index} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-lg text-gray-600">
            {searchQuery
              ? `「${sanitizeSearchQuery(searchQuery)}」に該当するメールが見つかりません`
              : "メールがありません"}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
              {messages.map((message) => (
                <a
                  key={message.messageId}
                  href={`/messages/${message.messageId}`}
                  className={`block p-4 border-b border-gray-100 last:border-b-0 no-underline text-inherit transition-colors hover:bg-gray-50 ${!message.isRead ? "bg-blue-50" : ""}`}
                >
                  <div className="flex justify-between items-start max-sm:flex-col max-sm:gap-2">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span
                          className={`text-sm ${!message.isRead ? "font-bold" : ""}`}
                        >
                          {sanitizeEmailText(message.from)}
                        </span>
                        {!selectedMailbox && (
                          <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-xl text-xs text-gray-600">
                            {message.mailbox}
                          </span>
                        )}
                        {message.hasAttachments && (
                          <span className="ml-2 text-xs">📎</span>
                        )}
                      </div>
                      <div
                        className={`mb-1 ${!message.isRead ? "font-bold" : ""}`}
                      >
                        {sanitizeEmailText(message.subject) || "(件名なし)"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-right min-w-[100px] max-sm:text-left max-sm:min-w-auto">
                      {new Date(message.date).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* ページネーション */}
            {pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.itemsPerPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Messages;
