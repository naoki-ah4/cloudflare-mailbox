import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/admin/setup", "routes/admin/setup.tsx"),
  route("/admin/login", "routes/admin/login.tsx"),
  route("/admin", "routes/admin/dashboard.tsx"),
  
  // 管理者API
  route("/api/admin/logout", "routes/api/admin/logout.tsx"),
  route("/api/admin/users", "routes/api/admin/users.tsx"),
  route("/api/admin/invites", "routes/api/admin/invites.tsx"),
  route("/api/admin/administrators", "routes/api/admin/administrators.tsx"),
] satisfies RouteConfig;
