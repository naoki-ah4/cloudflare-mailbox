import { useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { SessionKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import type { EmailMetadata } from "~/utils/kv/schema";
import styles from "./messages.module.scss";

export async function loader({ request, context }: LoaderFunctionArgs) {
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
            <p style={{ color: "#007bff" }}>{stats.totalMessages}</p>
            <h3>総数</h3>
          </div>
          <div className={styles.statCard}>
            <p style={{ color: "#dc3545" }}>{stats.unreadMessages}</p>
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
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: selectedMailbox === email ? "#007bff" : "white",
                    color: selectedMailbox === email ? "white" : "#333",
                    border: "1px solid " + (selectedMailbox === email ? "#007bff" : "#dee2e6"),
                    borderRadius: "4px",
                    textAlign: "left",
                    cursor: "pointer",
                    marginBottom: "0.25rem",
                    fontSize: "0.875rem"
                  }}
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
            style={{
              display: "block",
              padding: "0.75rem",
              backgroundColor: "#6c757d",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              textAlign: "center"
            }}
          >
            ダッシュボードに戻る
          </a>
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div style={{ flex: 1, padding: "1rem" }}>
        <header style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "1rem",
          borderBottom: "1px solid #eee",
          paddingBottom: "1rem"
        }}>
          <div>
            <h1 style={{ margin: "0" }}>
              {selectedMailbox ? `${selectedMailbox}` : "すべてのメール"}
            </h1>
            <p style={{ margin: "0.25rem 0 0 0", color: "#666" }}>
              {messages.length}件のメール
            </p>
          </div>
          
          <form method="post" action="/api/logout">
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              ログアウト
            </button>
          </form>
        </header>
        
        {/* 検索バー */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="件名または送信者で検索..."
            defaultValue={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const timeoutId = setTimeout(() => handleSearch(value), 300);
              return () => clearTimeout(timeoutId);
            }}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "1rem"
            }}
          />
        </div>
        
        {/* メール一覧 */}
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "3rem", 
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            color: "#666"
          }}>
            {searchQuery ? 
              `「${searchQuery}」に該当するメールが見つかりません` :
              "メールがありません"
            }
          </div>
        ) : (
          <div style={{ 
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #dee2e6",
            overflow: "hidden"
          }}>
            {messages.map((message) => (
              <a
                key={message.messageId}
                href={`/messages/${message.messageId}`}
                style={{
                  display: "block",
                  padding: "1rem",
                  borderBottom: "1px solid #f8f9fa",
                  textDecoration: "none",
                  color: "inherit",
                  backgroundColor: message.isRead ? "white" : "#f0f8ff"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = message.isRead ? "white" : "#f0f8ff";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ 
                        fontWeight: message.isRead ? "normal" : "bold",
                        fontSize: "0.875rem"
                      }}>
                        {message.from}
                      </span>
                      {!selectedMailbox && (
                        <span style={{ 
                          marginLeft: "0.5rem",
                          padding: "0.125rem 0.5rem",
                          backgroundColor: "#e9ecef",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          color: "#666"
                        }}>
                          {message.mailbox}
                        </span>
                      )}
                      {message.hasAttachments && (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>📎</span>
                      )}
                    </div>
                    <div style={{ 
                      fontWeight: message.isRead ? "normal" : "bold",
                      marginBottom: "0.25rem"
                    }}>
                      {message.subject || "(件名なし)"}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: "0.75rem", 
                    color: "#666",
                    textAlign: "right",
                    minWidth: "100px"
                  }}>
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