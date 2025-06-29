import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getSession, destroySession } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

export async function loader() {
  return redirect("/admin/login");
}