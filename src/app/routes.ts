import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // 管理者認証・管理
  route("/admin/setup", "routes/admin/setup.tsx"),
  route("/admin/login", "routes/admin/login.tsx"),
  route("/admin", "routes/admin/dashboard.tsx"),
  route("/admin/users", "routes/admin/users.tsx"),
  route("/admin/invites", "routes/admin/invites.tsx"),
  route("/admin/administrators", "routes/admin/administrators.tsx"),
  route("/admin/system-settings", "routes/admin/system-settings.tsx"),
  route(
    "/admin/system-settings/history",
    "routes/admin/system-settings/history.tsx"
  ),
  route("/admin/backup", "routes/admin/backup.tsx"),

  // ユーザー認証・ダッシュボード
  route("/signup", "routes/signup.tsx"),
  route("/login", "routes/login.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
  route("/settings", "routes/settings._index.tsx"),
  route("/settings/password", "routes/settings/password.tsx"),
  route("/profile", "routes/profile.tsx"),

  // メール閲覧・作成機能
  route("/messages", "routes/messages.tsx"),
  route("/messages/:messageId", "routes/messages.$messageId.tsx"),
  route("/compose", "routes/compose.tsx"),

  // 専用APIエンドポイント（UIなし）
  route("/api/admin/logout", "routes/api/admin/logout.tsx"),
  route("/api/logout", "routes/api/logout.tsx"),
  route(
    "/api/attachments/:messageId/:filename",
    "routes/api/attachments.$messageId.$filename.tsx"
  ),
  route("/api/messages/mark-read", "routes/api/messages/mark-read.tsx"),
] satisfies RouteConfig;
