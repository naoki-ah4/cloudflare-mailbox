import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { AdminKV, UserKV } from "~/utils/kv";
import styles from "./dashboard.module.scss";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  // 統計情報を取得（認証チェックはworkers/app.tsで実施済み）
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

export default () => {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
        <form method="post" action="/api/admin/logout">
          <button type="submit" className={styles.logoutButton}>
            ログアウト
          </button>
        </form>
      </header>
      
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.adminStat}`}>
          <h3>管理者数</h3>
          <p>{stats.adminCount}</p>
        </div>
        
        <div className={`${styles.statCard} ${styles.userStat}`}>
          <h3>ユーザー数</h3>
          <p>{stats.userCount}</p>
        </div>
      </div>
      
      <div className={styles.actionsGrid}>
        <a href="/admin/users" className={styles.actionCard}>
          <h3>ユーザー管理</h3>
          <p>ユーザーの一覧表示、削除、詳細確認</p>
        </a>
        
        <a href="/admin/invites" className={styles.actionCard}>
          <h3>招待管理</h3>
          <p>招待URL生成、管理、使用状況確認</p>
        </a>
        
        <a href="/admin/administrators" className={styles.actionCard}>
          <h3>管理者管理</h3>
          <p>管理者の追加、一覧表示、削除</p>
        </a>
        
        <a href="/admin/system-settings" className={styles.actionCard}>
          <h3>システム設定</h3>
          <p>許可ドメインの管理、システム設定の変更</p>
        </a>
      </div>
    </div>
  );
}