import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getUserSession, destroyUserSession } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getUserSession(request.headers.get("Cookie"));
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroyUserSession(session),
    },
  });
}

export async function loader() {
  return redirect("/login");
}