# Cloudflare Mailbox

Cloudflare Workers と KV ストレージを使用した強力なメール管理システムです。複数のメールアドレスを一元管理し、効率的なメール処理機能を提供します。

## ✨ 主な機能

### 🔐 ユーザー管理

- **ユーザー名ベース認証**: メールアドレスではなくユーザー名でログイン
- **招待制登録**: 管理者が発行した招待トークンによる安全な登録
- **ハイブリッドセッション管理**: React Router v7 + KV 統合による最適なパフォーマンス

### 📧 複数メールボックス管理

- **複数アドレス対応**: 1ユーザーが複数のメールアドレスを管理可能
- **独立したインボックス**: 各メールアドレスが独自のインボックスを持つ
- **統合ビュー**: 全メールボックスの一括表示も可能

### 📎 ファイル管理

- **添付ファイル対応**: 設定可能なサイズ制限でメール添付ファイルを処理（デフォルト: 25MB）
- **R2 ストレージ統合**: Cloudflare R2 を使用した効率的な添付ファイル保存
- **安全なファイル処理**: バリデーション付きの安全な添付ファイル処理

### 🔄 バックアップシステム

- **自動バックアップ**: 日次、週次、月次の自動バックアップ
- **圧縮**: ストレージ最適化のための効率的な deflate 圧縮
- **保持ポリシー**: 自動クリーンアップ付きのインテリジェントなデータ保持
- **ワンクリック復元**: バックアップからの完全なシステム復元
- **手動バックアップ**: オンデマンドでバックアップを作成

### ⚡ パフォーマンス最適化

- **O(1) アクセス**: 高速検索のためのユーザー名ベースインデックス
- **並列処理**: 同時メールボックス操作
- **エッジコンピューティング**: Cloudflare Workers による世界規模のパフォーマンス

## 🚀 セットアップ

### 前提条件

- Node.js 18+ と Bun パッケージマネージャー
- Workers と KV が有効な Cloudflare アカウント
- 添付ファイル用の R2 バケット（オプションですが推奨）

### インストール

1. **リポジトリをクローン**

   ```bash
   git clone https://github.com/naoki-ah4/cloudflare-mailbox
   cd cloudflare-mailbox
   ```

2. **依存関係をインストール**

   ```bash
   bun install
   ```

3. **設定ファイルのセットアップ**

   ```bash
   # サンプル設定をコピー
   cp wrangler.sample.jsonc wrangler.jsonc
   ```

4. **設定の変更**
   `wrangler.jsonc` を編集し、プレースホルダーを実際の値に置き換えます：
   - `<YOUR_MESSAGES_KV_ID>`: メッセージ用 KV 名前空間 ID
   - `<YOUR_USERS_KV_ID>`: ユーザー用 KV 名前空間 ID
   - `<YOUR_MAILBOXES_KV_ID>`: メールボックス用 KV 名前空間 ID
   - `<YOUR_SYSTEM_KV_ID>`: システムデータ用 KV 名前空間 ID
   - `<YOUR_R2_BUCKET_NAME>`: 添付ファイル用 R2 バケット名
   - `<YOUR_CLOUDFLARE_ACCOUNT_ID>`: Cloudflare アカウント ID
   - `<YOUR_R2_ACCESS_KEY_ID>`: R2 アクセスキー ID
   - `<YOUR_R2_SECRET_ACCESS_KEY>`: R2 シークレットアクセスキー
   - `<YOUR_RESEND_API_KEY>`: メール送信用 Resend API キー

5. **KV 名前空間の作成**

   ```bash
   # 必要な KV 名前空間を作成
   bunx wrangler kv:namespace create "MESSAGES_KV"
   bunx wrangler kv:namespace create "USERS_KV"
   bunx wrangler kv:namespace create "MAILBOXES_KV"
   bunx wrangler kv:namespace create "SYSTEM_KV"
   ```

6. **R2 バケットの作成**（オプション）
   ```bash
   bunx wrangler r2 bucket create your-bucket-name
   ```

### 開発

開発サーバーを起動：

```bash
bun run dev
```

アプリケーションは `http://localhost:5173` で利用可能になります。

### ビルドとデプロイ

1. **プロジェクトをビルド**

   ```bash
   bun run build
   ```

2. **Cloudflare Workers にデプロイ**

   ```bash
   bun run deploy
   ```

3. **プレビューデプロイ**
   ```bash
   bunx wrangler versions upload
   bunx wrangler versions deploy
   ```

### テスト (未実装)

カバレッジ付きでテストを実行：

```bash
bun test
```

## 🛠️ 技術スタック

### フロントエンド

- **React 19**: 最新の React と並行機能
- **React Router v7**: SSR サポート付きの最新ルーティング
- **Vite**: 高速ビルドツールと開発サーバー
- **Tailwind CSS**: ユーティリティファーストの CSS フレームワーク
- **TypeScript**: 型安全な JavaScript

### バックエンド

- **Cloudflare Workers**: エッジコンピューティングランタイム
- **Cloudflare KV**: グローバルキーバリューストレージ
- **Cloudflare R2**: 添付ファイル用オブジェクトストレージ
- **Postal MIME**: メール解析と処理
- **Resend**: メール送信サービス

### 開発ツール

- **Bun**: 高速 JavaScript ランタイムとパッケージマネージャー
- **ESLint**: コードリンティングとフォーマッティング
- **Prettier**: コードフォーマッティング
- **Husky**: Git フック
- **Lint-staged**: プリコミットリンティング

## 📁 プロジェクト構造

```
cloudflare-mailbox/
├── workers/                    # Cloudflare Workers
│   └── app.ts                 # メインワーカーエントリーポイント
├── src/
│   ├── email/                 # メール処理システム
│   ├── utils/                 # 共通ユーティリティ
│   │   └── kv/               # KV ストレージユーティリティ
│   └── app/                  # React Router v7 アプリ
│       ├── routes/           # ページコンポーネント
│       │   ├── admin/        # 管理者ページ
│       │   └── api/          # API ルート
│       ├── components/       # 再利用可能コンポーネント
│       └── routes.ts         # ルート定義
├── public/                   # 静的ファイル
└── 設定ファイル
```

## 🔧 設定

### 環境変数

- `MAX_ATTACHMENTS_SIZE`: 添付ファイルの最大サイズ（バイト単位、デフォルト: 25MB）
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare アカウント ID
- `R2_BUCKET_NAME`: 添付ファイル用 R2 バケット名
- `FORWARD_EMAIL_ADDRESS`: メール転送先アドレス
- `ADMIN_IPS`: 管理者 IP アドレスのカンマ区切りリスト
- `NODE_ENV`: 環境（development/production）
- `RESEND_API_KEY`: Resend メールサービスの API キー

### Cron トリガー

- `0 2 * * *`: 毎日午前 2 時に日次バックアップ
- `0 3 * * 7`: 毎週日曜日午前 3 時に週次バックアップ
- `0 4 1 * *`: 毎月 1 日午前 4 時に月次バックアップ

## 🤝 貢献

1. リポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add some amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

コードがプロジェクトのコーディング標準に従い、適切なテストが含まれていることを確認してください。

## 📝 ライセンス

このプロジェクトは Apache License 2.0 の下でライセンスされています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

### サードパーティライセンス

このプロジェクトは複数のオープンソースライブラリを使用しています。主な依存関係：

- React (MIT License)
- React Router (MIT License)
- Vite (MIT License)
- Tailwind CSS (MIT License)
- Cloudflare Workers SDK (Apache 2.0 License)
- Postal MIME (MIT License)
- Resend SDK (MIT License)

依存関係とそのライセンスの完全なリストは、`package.json` ファイルを確認してください。

## 🔒 セキュリティ

このプロジェクトはセキュリティを考慮して設計されています：

- 機密データのログ記録や露出なし
- 安全なセッション管理
- 入力検証とサニタイゼーション
- レート制限と IP ベースのアクセス制御

セキュリティ脆弱性を発見した場合は、メンテナーに非公開で報告してください。

---

❤️ を込めて Cloudflare Workers と React Router v7 で構築されています。
