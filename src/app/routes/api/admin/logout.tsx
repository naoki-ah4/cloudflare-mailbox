import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getAdminSession, destroyAdminSession } from "~/utils/session.server";
import { AdminSessionKV } from "~/utils/kv";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
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
}

export async function loader() {
  return redirect("/admin/login");
}