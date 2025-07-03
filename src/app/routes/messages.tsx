import { useLoaderData, useSearchParams, useNavigation } from "react-router";
import type { Route } from "./+types/messages";
import { SessionKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import type { EmailMetadata } from "~/utils/kv/schema";
import { sanitizeEmailText, sanitizeSearchQuery } from "~/utils/sanitize";
import styles from "./messages.module.scss";
import Pagination from "../components/Pagination";
import { useState } from "react";
import { SkeletonMessageItem } from "../components/elements/SkeletonLoader";

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
    <div className={styles.container}>
      {/* モバイル用サイドバーオーバーレイ */}
      <div
        className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.open : ""}`}
        onClick={closeSidebar}
      />

      {/* サイドバー */}
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
        {/* モバイル用閉じるボタン */}
        <button className={styles.sidebarCloseButton} onClick={closeSidebar}>
          ✕
        </button>

        <div className={styles.sidebarHeader}>
          <h2>メールボックス</h2>
          <p>{user.email}</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <p className="text-blue-600">{stats.totalMessages}</p>
            <h3>総数</h3>
          </div>
          <div className={styles.statCard}>
            <p className="text-red-600">{stats.unreadMessages}</p>
            <h3>未読</h3>
          </div>
        </div>

        <div className={styles.mailboxSection}>
          <h3>フィルタ</h3>

          <div className={styles.mailboxList}>
            <button
              onClick={() => handleMailboxChange("all")}
              className={`${styles.mailboxItem} ${!selectedMailbox ? styles.active : ""}`}
            >
              <div className={styles.mailboxName}>
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
      <div className={styles.mainContentArea}>
        <header className={styles.contentHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* モバイル用ハンバーガーメニューボタン */}
            <button className={styles.mobileMenuButton} onClick={toggleSidebar}>
              ☰
            </button>
            <div>
              <h1>
                {selectedMailbox ? `${selectedMailbox}` : "すべてのメール"}
              </h1>
              <p>
                {pagination.totalItems}件のメール（{pagination.currentPage}/
                {pagination.totalPages}ページ）
              </p>
            </div>
          </div>

          <form method="post" action="/api/logout">
            <button type="submit" className={styles.logoutBtn}>
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
          <div className={styles.messagesContainer}>
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonMessageItem key={index} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.noMessagesContainer}>
            {searchQuery
              ? `「${sanitizeSearchQuery(searchQuery)}」に該当するメールが見つかりません`
              : "メールがありません"}
          </div>
        ) : (
          <>
            <div className={styles.messagesContainer}>
              {messages.map((message) => (
                <a
                  key={message.messageId}
                  href={`/messages/${message.messageId}`}
                  className={`${styles.messageItem} ${!message.isRead ? styles.unread : ""}`}
                >
                  <div className={styles.messageItemContent}>
                    <div className={styles.messageItemLeft}>
                      <div className={styles.messageItemHeader}>
                        <span
                          className={`${styles.messageFrom} ${!message.isRead ? styles.unread : ""}`}
                        >
                          {sanitizeEmailText(message.from)}
                        </span>
                        {!selectedMailbox && (
                          <span className={styles.messageMailboxTag}>
                            {message.mailbox}
                          </span>
                        )}
                        {message.hasAttachments && (
                          <span className={styles.attachmentIcon}>📎</span>
                        )}
                      </div>
                      <div
                        className={`${styles.messageSubject} ${!message.isRead ? styles.unread : ""}`}
                      >
                        {sanitizeEmailText(message.subject) || "(件名なし)"}
                      </div>
                    </div>
                    <div className={styles.messageDate}>
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
