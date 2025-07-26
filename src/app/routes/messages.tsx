import { useLoaderData, useSearchParams, useNavigation } from "react-router";
import type { Route } from "./+types/messages";
import { SessionKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import type { EmailMetadata } from "~/utils/schema";
import { sanitizeEmailText, sanitizeSearchQuery } from "~/utils/sanitize";
import Pagination from "../components/Pagination";
import { useState, useCallback, useMemo } from "react";
import { SkeletonMessageItem } from "../components/elements/SkeletonLoader";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useNewEmailNotification } from "../hooks/useNewEmailNotification";
import VirtualMessageList from "../components/elements/VirtualMessageList";

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
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [isSelectAllMode, setIsSelectAllMode] = useState(false);
  const navigation = useNavigation();

  const isLoading = navigation.state === "loading";

  // キーボードナビゲーション対応
  const focusTrapRef = useFocusTrap(sidebarOpen);
  useEscapeKey(() => setSidebarOpen(false), sidebarOpen);

  // 新着メール通知
  const { canShowNotifications, enableNotifications } = useNewEmailNotification(
    {
      emails: messages,
      enabled: true,
    }
  );

  // _showInfoは新着メール通知のuseNewEmailNotificationで使用されている（showInfo変数として）

  // 大量メール時の仮想スクロール判定
  const useVirtualScrolling = messages.length > 100;

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

  const currentPageMessageIds = useMemo(
    () => new Set(messages.map((m) => m.messageId)),
    [messages]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedMessageIds(new Set(currentPageMessageIds));
      } else {
        setSelectedMessageIds(new Set());
        setIsSelectAllMode(false);
      }
    },
    [currentPageMessageIds]
  );

  const handleSelectMessage = useCallback(
    (messageId: string, checked: boolean) => {
      setSelectedMessageIds((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
          setIsSelectAllMode(false);
        }
        return newSet;
      });
    },
    []
  );

  const handleMarkSelectedAsRead = async () => {
    const messagesByMailbox = new Map<string, string[]>();

    if (isSelectAllMode) {
      if (selectedMailbox) {
        const allMessageIds = messages
          .filter((m) => !m.isRead)
          .map((m) => m.messageId);
        messagesByMailbox.set(selectedMailbox, allMessageIds);
      } else {
        messages
          .filter((m) => !m.isRead)
          .forEach((message) => {
            const mailboxMessages =
              messagesByMailbox.get(message.mailbox) || [];
            mailboxMessages.push(message.messageId);
            messagesByMailbox.set(message.mailbox, mailboxMessages);
          });
      }
    } else {
      messages
        .filter((m) => selectedMessageIds.has(m.messageId) && !m.isRead)
        .forEach((message) => {
          const mailboxMessages = messagesByMailbox.get(message.mailbox) || [];
          mailboxMessages.push(message.messageId);
          messagesByMailbox.set(message.mailbox, mailboxMessages);
        });
    }

    try {
      const promises = Array.from(messagesByMailbox.entries()).map(
        async ([mailbox, messageIds]) => {
          const formData = new FormData();
          formData.append("messageIds", JSON.stringify(messageIds));
          formData.append("mailbox", mailbox);

          const response = await fetch("/api/messages/mark-read", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to mark messages as read for ${mailbox}`);
          }
        }
      );

      await Promise.all(promises);
      setSelectedMessageIds(new Set());
      setIsSelectAllMode(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
      alert("既読処理に失敗しました");
    }
  };

  const isAllSelected =
    currentPageMessageIds.size > 0 &&
    Array.from(currentPageMessageIds).every((id) => selectedMessageIds.has(id));

  const selectedCount = isSelectAllMode
    ? stats.unreadMessages
    : selectedMessageIds.size;

  return (
    <div className="flex min-h-screen lg:flex-row max-lg:flex-col">
      {/* モバイル用サイドバーオーバーレイ */}
      <div
        className={`hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:bg-black/50 max-md:z-[999] ${sidebarOpen ? "max-md:block" : ""}`}
        onClick={closeSidebar}
      />

      {/* サイドバー */}
      <aside
        id="sidebar"
        ref={focusTrapRef}
        role="navigation"
        aria-label="メールボックス一覧"
        className={`w-72 bg-gray-50 border-r border-gray-300 p-4 max-lg:w-full max-lg:border-r-0 max-lg:border-b max-lg:border-gray-300 max-md:hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen max-md:w-72 max-md:z-[1000] max-md:shadow-lg ${sidebarOpen ? "max-md:block" : ""}`}
      >
        {/* モバイル用閉じるボタン */}
        <button
          className="hidden max-md:block max-md:absolute max-md:top-4 max-md:right-4 max-md:bg-transparent max-md:border-none max-md:text-xl max-md:cursor-pointer max-md:text-gray-500 max-md:z-[1001]"
          onClick={closeSidebar}
          aria-label="サイドバーを閉じる"
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
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 p-4 max-md:p-3">
        <header className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4 max-md:flex-col max-md:items-start max-md:gap-4">
          <div className="flex items-center gap-4">
            {/* モバイル用ハンバーガーメニューボタン */}
            <button
              className="hidden max-md:block bg-transparent border-none text-xl cursor-pointer p-2 text-gray-700"
              onClick={toggleSidebar}
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
              aria-label="サイドバーを開く"
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

          <div className="flex items-center gap-2">
            {/* 通知設定ボタン */}
            {!canShowNotifications && (
              <button
                onClick={() => void enableNotifications()}
                className="px-3 py-2 bg-blue-600 text-white border-none rounded cursor-pointer text-sm hover:bg-blue-700 transition-colors"
                title="デスクトップ通知を有効にする"
              >
                🔔 通知を有効にする
              </button>
            )}

            <form method="post" action="/api/logout">
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer"
              >
                ログアウト
              </button>
            </form>
          </div>
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

        {/* 選択アクションバー */}
        {selectedCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-700 font-medium">
                {selectedCount}件選択中
              </span>
              {!isSelectAllMode && stats.unreadMessages > selectedCount && (
                <button
                  onClick={() => setIsSelectAllMode(true)}
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  フィルタ条件の全{stats.unreadMessages}件を選択
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void handleMarkSelectedAsRead()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
              >
                既読にする
              </button>
              <button
                onClick={() => {
                  setSelectedMessageIds(new Set());
                  setIsSelectAllMode(false);
                }}
                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
              >
                選択解除
              </button>
            </div>
          </div>
        )}

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
        ) : useVirtualScrolling ? (
          <>
            {/* 仮想スクロール使用時 */}
            <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              📊 大量のメール（{messages.length}
              件）のため、仮想スクロールを使用しています
            </div>
            <VirtualMessageList
              messages={messages}
              selectedMailbox={selectedMailbox}
              containerHeight={600}
            />
          </>
        ) : (
          <>
            {/* 通常のリスト表示 */}
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
              {/* ヘッダー行 */}
              <div className="flex items-center p-3 border-b border-gray-200 bg-gray-50">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="mr-3 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  aria-label="すべて選択"
                />
                <span className="text-sm text-gray-600">すべて選択</span>
              </div>

              {/* メールリスト */}
              {messages.map((message) => (
                <div
                  key={message.messageId}
                  className={`flex items-start p-4 border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50 ${!message.isRead ? "bg-blue-50" : ""} ${selectedMessageIds.has(message.messageId) ? "bg-blue-100" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMessageIds.has(message.messageId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectMessage(message.messageId, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mr-3 mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    aria-label={`${message.subject}を選択`}
                  />
                  <a
                    href={`/messages/${message.messageId}`}
                    className="flex-1 no-underline text-inherit"
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
                            <span className="ml-2 text-xs" aria-hidden="true">
                              📎
                            </span>
                          )}
                        </div>
                        <div
                          className={`mb-1 ${!message.isRead ? "font-bold" : ""}`}
                        >
                          {sanitizeEmailText(message.subject) || "(件名なし)"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 text-right min-w-[100px] max-sm:text-left max-sm:min-w-auto">
                        <time dateTime={message.date.toISOString()}>
                          {message.date.toLocaleString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </div>
                  </a>
                </div>
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
