import { createRequestHandler } from "react-router";
import EmailApp from "~/email";
import { authenticateAdmin, authenticateUser } from "~/utils/auth.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // パス別認証チェック
    if (
      ["/", "/login", "/login.data", "/signup", "/signup.data"].includes(
        url.pathname
      )
    ) {
      // 公開ページは認証不要でそのまま通す
      return requestHandler(request, {
        cloudflare: { env, ctx },
      });
    } else if (url.pathname.startsWith("/admin")) {
      // 管理者ページの認証チェック
      const authResult = await authenticateAdmin(request, env);

      if (!authResult.isAuthenticated) {
        if (authResult.redirect) {
          return Response.redirect(
            new URL(authResult.redirect, request.url).toString(),
            302
          );
        }
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      // その他のユーザーページは認証必須
      const authResult = await authenticateUser(request, env);

      if (!authResult.isAuthenticated) {
        if (authResult.redirect) {
          return Response.redirect(
            new URL(authResult.redirect, request.url).toString(),
            302
          );
        }
        return new Response("Unauthorized", { status: 401 });
      }
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  email: EmailApp.email,
} satisfies ExportedHandler<Env>;
