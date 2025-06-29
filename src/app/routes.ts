import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/admin/setup", "routes/admin/setup.tsx"),
  route("/admin/login", "routes/admin/login.tsx"),
  route("/admin", "routes/admin/dashboard.tsx"),
] satisfies RouteConfig;
