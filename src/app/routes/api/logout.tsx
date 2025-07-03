import { redirect } from "react-router";
import { getUserSession, destroyUserSession } from "~/utils/session.server";
import { SessionKV } from "~/utils/kv";
import type { Route } from "./+types/logout";

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

  try {
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    // KVセッションも削除
    if (sessionId) {
      await SessionKV.delete(env.USERS_KV, sessionId);
    }

    return redirect("/login", {
      headers: {
        "Set-Cookie": await destroyUserSession(session),
      },
    });
  } catch (error) {
    console.error("User logout error:", error);
    return redirect("/login");
  }
};

export const loader = async () => {
  return redirect("/login");
};
