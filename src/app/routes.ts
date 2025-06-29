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
  
  // ユーザー認証・ダッシュボード
  route("/signup", "routes/signup.tsx"),
  route("/login", "routes/login.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
  
  // 専用APIエンドポイント（UIなし）
  route("/api/admin/logout", "routes/api/admin/logout.tsx"),
  route("/api/user/logout", "routes/api/user/logout.tsx"),
] satisfies RouteConfig;
