import type { Route } from "./+types/home";

export const meta = ({ params }: Route.MetaArgs) => {
  return [
    { title: "Cloudflare Mailbox - セキュアなメール管理システム" },
    { name: "description", content: "Cloudflare Workers上で動作するプライベートメール管理システム" },
  ];
};

export const loader = ({ context }: Route.LoaderArgs) => {
  return {};
};

const Home = ({ loaderData }: Route.ComponentProps) => {
  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem"
    }}>
      <div style={{
        maxWidth: "800px",
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "3rem",
        textAlign: "center",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ 
            fontSize: "3rem", 
            fontWeight: "bold",
            margin: "0 0 1rem 0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            📧 Cloudflare Mailbox
          </h1>
          <p style={{ 
            fontSize: "1.25rem", 
            color: "#666",
            margin: "0",
            lineHeight: "1.6"
          }}>
            Cloudflare Workers上で動作する<br />
            セキュアなプライベートメール管理システム
          </p>
        </div>

        {/* 特徴 */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          marginBottom: "3rem"
        }}>
          <div style={{ padding: "1rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔒</div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>招待制アクセス</h3>
            <p style={{ margin: "0", fontSize: "0.875rem", color: "#666" }}>
              管理者による招待制で<br />セキュアなアクセス管理
            </p>
          </div>
          
          <div style={{ padding: "1rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚡</div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>高速・軽量</h3>
            <p style={{ margin: "0", fontSize: "0.875rem", color: "#666" }}>
              Cloudflare Workers<br />エッジでの高速処理
            </p>
          </div>
          
          <div style={{ padding: "1rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📱</div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>マルチデバイス</h3>
            <p style={{ margin: "0", fontSize: "0.875rem", color: "#666" }}>
              デスクトップ・モバイル<br />どこからでもアクセス
            </p>
          </div>
        </div>

        {/* アクションボタン */}
        <div style={{ 
          display: "flex", 
          gap: "1rem", 
          justifyContent: "center",
          flexWrap: "wrap"
        }}>
          <a 
            href="/login"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#667eea",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            ログイン
          </a>
          
          <a 
            href="/signup"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "transparent",
              color: "#667eea",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              border: "2px solid #667eea",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#667eea";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#667eea";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            招待コードで登録
          </a>
        </div>

        {/* フッター */}
        <div style={{ 
          marginTop: "3rem", 
          paddingTop: "2rem", 
          borderTop: "1px solid #eee",
          fontSize: "0.875rem",
          color: "#999"
        }}>
          <p style={{ margin: "0" }}>
            Powered by Cloudflare Workers, KV, R2
          </p>
        </div>
      </div>
    </div>
  );
}
