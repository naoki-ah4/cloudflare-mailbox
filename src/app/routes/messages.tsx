import { useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { SessionKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import type { EmailMetadata } from "~/utils/kv/schema";
import styles from "./messages.module.scss";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
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
    
    // メールボックス取得
    let allMessages: (EmailMetadata & { mailbox: string })[] = [];
    
    if (selectedMailbox) {
      // 特定のメールボックスのみ
      if (kvSession.managedEmails.includes(selectedMailbox)) {
        const messages = await InboxKV.get(env.MAILBOXES_KV, selectedMailbox);
        allMessages = messages.map(msg => ({ ...msg, mailbox: selectedMailbox }));
      }
    } else {
      // 全メールボックス統合
      for (const email of kvSession.managedEmails) {
        const messages = await InboxKV.get(env.MAILBOXES_KV, email);
        // メールボックス情報を追加
        const messagesWithMailbox = messages.map(msg => ({
          ...msg,
          mailbox: email
        }));
        allMessages.push(...messagesWithMailbox);
      }
      
      // 日付順ソート（新しい順）
      allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // 検索フィルタ
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allMessages = allMessages.filter(msg => 
        msg.subject.toLowerCase().includes(query) ||
        msg.from.toLowerCase().includes(query)
      );
    }
    
    // 統計計算
    const totalMessages = allMessages.length;
    const unreadMessages = allMessages.filter(msg => !msg.isRead).length;
    
    return {
      messages: allMessages,
      managedEmails: kvSession.managedEmails,
      selectedMailbox,
      searchQuery,
      stats: {
        totalMessages,
        unreadMessages,
      },
      user: {
        email: kvSession.email,
      }
    };
  } catch (error) {
    console.error("Failed to load messages:", error);
    throw new Error("メール一覧の取得に失敗しました");
  }
}

const Messages = () => {
  const { 
    messages, 
    managedEmails, 
    selectedMailbox, 
    searchQuery, 
    stats,
    user 
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleMailboxChange = (mailbox: string) => {
    const params = new URLSearchParams(searchParams);
    if (mailbox === "all") {
      params.delete("mailbox");
    } else {
      params.set("mailbox", mailbox);
    }
    setSearchParams(params);
  };

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set("search", query);
    } else {
      params.delete("search");
    }
    setSearchParams(params);
  };

  return (
    <div className={styles.container}>
      {/* サイドバー */}
      <div className={styles.sidebar}>
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
              className={`${styles.mailboxItem} ${!selectedMailbox ? styles.active : ''}`}
            >
              <div className={styles.mailboxName}>📥 すべて ({stats.totalMessages})</div>
            </button>
            
            {managedEmails.map((email) => {
              const emailMessages = messages.filter(msg => 
                selectedMailbox ? msg.mailbox === email : msg.mailbox === email
              );
              const emailCount = selectedMailbox ? emailMessages.length : 
                messages.filter(msg => msg.mailbox === email).length;
              
              return (
                <button
                  key={email}
                  onClick={() => handleMailboxChange(email)}
                  className={`w-full px-3 py-2 rounded text-left cursor-pointer mb-1 text-sm border ${
                    selectedMailbox === email 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-800 border-gray-300'
                  }`}
                >
                  📧 {email.split('@')[0]} ({emailCount})
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
          <div>
            <h1>
              {selectedMailbox ? `${selectedMailbox}` : "すべてのメール"}
            </h1>
            <p>
              {messages.length}件のメール
            </p>
          </div>
          
          <form method="post" action="/api/logout">
            <button
              type="submit"
              className={styles.logoutBtn}
            >
              ログアウト
            </button>
          </form>
        </header>
        
        {/* 検索バー */}
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="件名または送信者で検索..."
            defaultValue={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const timeoutId = setTimeout(() => handleSearch(value), 300);
              return () => clearTimeout(timeoutId);
            }}
          />
        </div>
        
        {/* メール一覧 */}
        {messages.length === 0 ? (
          <div className={styles.noMessagesContainer}>
            {searchQuery ? 
              `「${searchQuery}」に該当するメールが見つかりません` :
              "メールがありません"
            }
          </div>
        ) : (
          <div className={styles.messagesContainer}>
            {messages.map((message) => (
              <a
                key={message.messageId}
                href={`/messages/${message.messageId}`}
                className={`${styles.messageItem} ${!message.isRead ? styles.unread : ''}`}
              >
                <div className={styles.messageItemContent}>
                  <div className={styles.messageItemLeft}>
                    <div className={styles.messageItemHeader}>
                      <span className={`${styles.messageFrom} ${!message.isRead ? styles.unread : ''}`}>
                        {message.from}
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
                    <div className={`${styles.messageSubject} ${!message.isRead ? styles.unread : ''}`}>
                      {message.subject || "(件名なし)"}
                    </div>
                  </div>
                  <div className={styles.messageDate}>
                    {new Date(message.date).toLocaleString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;