import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export function loader() {
  // TODO: ユーザー認証ミドルウェア実装後にセッション情報を取得
  return {
    user: {
      username: "testuser",
      email: "test@example.com",
      managedEmails: ["mail1@example.com", "mail2@example.com"],
    },
    stats: {
      totalMessages: 0,
      unreadMessages: 0,
    }
  };
}

export default function Dashboard() {
  const { user, stats } = useLoaderData<typeof loader>();

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
        <form method="post" action="/api/user/logout">
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
        <ul style={{ margin: "0", paddingLeft: "1.5rem" }}>
          {user.managedEmails.map((email) => (
            <li key={email} style={{ marginBottom: "0.5rem" }}>
              <strong>{email}</strong>
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ 
        marginTop: "2rem",
        textAlign: "center",
        padding: "2rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        color: "#666"
      }}>
        <h3>メール閲覧機能は実装中です</h3>
        <p>Phase 4でメール一覧・詳細表示機能を実装予定です。</p>
      </div>
    </div>
  );
}