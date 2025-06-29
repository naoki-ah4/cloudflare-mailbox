import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { AdminKV, UserKV } from "~/utils/kv";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  // 統計情報を取得
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
}

export default function AdminDashboard() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "2rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "1rem"
      }}>
        <h1>管理者ダッシュボード</h1>
        <form method="post" action="/api/admin/logout">
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
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#007bff" }}>管理者数</h3>
          <p style={{ margin: "0", fontSize: "2rem", fontWeight: "bold" }}>
            {stats.adminCount}
          </p>
        </div>
        
        <div style={{ 
          padding: "1.5rem", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#28a745" }}>ユーザー数</h3>
          <p style={{ margin: "0", fontSize: "2rem", fontWeight: "bold" }}>
            {stats.userCount}
          </p>
        </div>
      </div>
      
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "1rem"
      }}>
        <a 
          href="/admin/users" 
          style={{ 
            display: "block",
            padding: "1.5rem", 
            backgroundColor: "white", 
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
            transition: "box-shadow 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>ユーザー管理</h3>
          <p style={{ margin: "0", color: "#666" }}>
            ユーザーの一覧表示、削除、詳細確認
          </p>
        </a>
        
        <a 
          href="/admin/invites" 
          style={{ 
            display: "block",
            padding: "1.5rem", 
            backgroundColor: "white", 
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
            transition: "box-shadow 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>招待管理</h3>
          <p style={{ margin: "0", color: "#666" }}>
            招待URL生成、管理、使用状況確認
          </p>
        </a>
        
        <a 
          href="/admin/administrators" 
          style={{ 
            display: "block",
            padding: "1.5rem", 
            backgroundColor: "white", 
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
            transition: "box-shadow 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>管理者管理</h3>
          <p style={{ margin: "0", color: "#666" }}>
            管理者の追加、一覧表示、削除
          </p>
        </a>
      </div>
    </div>
  );
}