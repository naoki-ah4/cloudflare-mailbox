import { redirect } from "react-router";
import { getAdminSession, destroyAdminSession } from "~/utils/session.server";
import { AdminSessionKV } from "~/utils/kv";
import type { Route } from "../+types/logout";

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;
  const session = await getAdminSession(request.headers.get("Cookie"));

  // KVからセッションを削除
  const sessionId = session.get("sessionId");
  if (sessionId) {
    await AdminSessionKV.delete(env.USERS_KV, sessionId);
  }

  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await destroyAdminSession(session),
    },
  });
};

export const loader = async () => {
  return redirect("/admin/login");
};
