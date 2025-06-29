import type { Route } from "./+types/home";
import styles from "./home.module.scss";

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params
}: Route.MetaArgs) => {
  return [
    { title: "Cloudflare Mailbox - セキュアなメール管理システム" },
    { name: "description", content: "Cloudflare Workers上で動作するプライベートメール管理システム" },
  ];
};

export const loader = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context
}: Route.LoaderArgs) => {
  return {};
};

const Home = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loaderData
}: Route.ComponentProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <h1>📧 Cloudflare Mailbox</h1>
          <p>
            Cloudflare Workers上で動作する<br />
            セキュアなプライベートメール管理システム
          </p>
        </div>

        {/* 特徴 */}
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.icon}>🔒</div>
            <h3>招待制アクセス</h3>
            <p>
              管理者による招待制で<br />セキュアなアクセス管理
            </p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.icon}>⚡</div>
            <h3>高速・軽量</h3>
            <p>
              Cloudflare Workers<br />エッジでの高速処理
            </p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.icon}>📱</div>
            <h3>マルチデバイス</h3>
            <p>
              デスクトップ・モバイル<br />どこからでもアクセス
            </p>
          </div>
        </div>

        {/* アクションボタン */}
        <div className={styles.actions}>
          <a href="/login" className={styles.primaryButton}>
            ログイン
          </a>
          
          <a href="/signup" className={styles.secondaryButton}>
            招待コードで登録
          </a>
        </div>

        {/* フッター */}
        <div className={styles.footer}>
          <p>Powered by Cloudflare Workers, KV, R2</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
