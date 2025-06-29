import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, UserKV, InboxKV } from "~/utils/kv";

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
    const totalMessages = mailboxStats.reduce((sum, stat) => sum + stat.total, 0);
    const unreadMessages = mailboxStats.reduce((sum, stat) => sum + stat.unread, 0);
    
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
}

export default function Dashboard() {
  const { user, stats, mailboxStats } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "2rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "1rem"
      }}>
        <div>
          <h1>メールボックス</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            ようこそ、{user.username}さん
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
      
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem"
      }}>
        <div style={{ 
          padding: "1.5rem", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#007bff" }}>総メール数</h3>
          <p style={{ margin: "0", fontSize: "2rem", fontWeight: "bold" }}>
            {stats.totalMessages}
          </p>
        </div>
        
        <div style={{ 
          padding: "1.5rem", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#dc3545" }}>未読メール</h3>
          <p style={{ margin: "0", fontSize: "2rem", fontWeight: "bold" }}>
            {stats.unreadMessages}
          </p>
        </div>
        
        <div style={{ 
          padding: "1.5rem", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#28a745" }}>管理メールボックス</h3>
          <p style={{ margin: "0", fontSize: "2rem", fontWeight: "bold" }}>
            {user.managedEmails.length}
          </p>
        </div>
      </div>
      
      <div style={{ 
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        padding: "1.5rem"
      }}>
        <h2 style={{ margin: "0 0 1rem 0" }}>管理中のメールアドレス</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {mailboxStats.map((stat) => (
            <div 
              key={stat.email} 
              style={{ 
                padding: "1rem",
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <strong style={{ fontSize: "1rem" }}>{stat.email}</strong>
              </div>
              <div style={{ 
                display: "flex", 
                gap: "1rem", 
                fontSize: "0.875rem",
                color: "#666"
              }}>
                <span>総数: <strong>{stat.total}</strong></span>
                <span>未読: <strong style={{ color: stat.unread > 0 ? "#dc3545" : "#28a745" }}>
                  {stat.unread}
                </strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ 
        marginTop: "2rem",
        textAlign: "center",
        padding: "2rem",
        backgroundColor: "#007bff",
        borderRadius: "8px",
        color: "white"
      }}>
        <h3>メール閲覧</h3>
        <p style={{ margin: "1rem 0" }}>メールの閲覧・管理を行えます。</p>
        <a 
          href="/messages"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            backgroundColor: "white",
            color: "#007bff",
            textDecoration: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          メール一覧を開く
        </a>
      </div>
    </div>
  );
}