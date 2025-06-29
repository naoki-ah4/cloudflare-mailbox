import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/admin/setup", "routes/admin/setup.tsx"),
  route("/admin/login", "routes/admin/login.tsx"),
  route("/admin", "routes/admin/dashboard.tsx"),
  
  // 管理者ページ（UI + API統合）
  route("/admin/users", "routes/admin/users.tsx"),
  route("/admin/invites", "routes/admin/invites.tsx"),
  route("/admin/administrators", "routes/admin/administrators.tsx"),
  
  // 専用APIエンドポイント（UIなし）
  route("/api/admin/logout", "routes/api/admin/logout.tsx"),
] satisfies RouteConfig;
