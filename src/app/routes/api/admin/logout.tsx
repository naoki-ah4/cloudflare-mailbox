import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getAdminSession, destroyAdminSession } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAdminSession(request.headers.get("Cookie"));

  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await destroyAdminSession(session),
    },
  });
}

export async function loader() {
  return redirect("/admin/login");
}