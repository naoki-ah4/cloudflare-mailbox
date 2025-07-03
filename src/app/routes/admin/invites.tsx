import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import { InviteKV } from "~/utils/kv";
import { redirect } from "react-router";
import type { Route } from "./+types/invites";
import { SafeFormData } from "~/app/utils/formdata";

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { env } = context.cloudflare;

  try {
    // 現在はInviteKV.listがないので、基本的な情報のみ
    const inviteCount = await InviteKV.count(env.USERS_KV);

    return {
      invites: [], // TODO: InviteKV.listを実装後に更新
      total: inviteCount,
    };
  } catch (error) {
    console.error("Failed to get invites:", error);
    throw new Error("招待一覧の取得に失敗しました");
  }
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

  if (request.method === "POST") {
    try {
      const formData = SafeFormData.fromObject(await request.formData());
      const expiresInHours = parseInt(formData.get("expiresInHours") ?? "24");

      // 招待トークン生成
      const token = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + expiresInHours * 60 * 60 * 1000;

      const invite = {
        token,
        createdAt: now,
        expiresAt,
        used: false,
      };

      await InviteKV.set(env.USERS_KV, token, invite);

      // 招待URLを生成
      const inviteUrl = `${new URL(request.url).origin}/signup?invite=${token}`;

      return {
        success: true,
        invite: {
          token,
          url: inviteUrl,
          expiresAt,
          expiresInHours,
        },
      };
    } catch (error) {
      console.error("Failed to create invite:", error);
      return { error: "招待URLの生成に失敗しました" };
    }
  }

  if (request.method === "DELETE") {
    try {
      const formData = SafeFormData.fromObject(await request.formData());
      const token = formData.get("token");

      if (!token) {
        return { error: "トークンが必要です" };
      }

      // 招待削除
      await InviteKV.delete(env.USERS_KV, token);

      return redirect("/admin/invites");
    } catch (error) {
      console.error("Failed to delete invite:", error);
      return { error: "招待の削除に失敗しました" };
    }
  }

  return { error: "許可されていないメソッドです" };
};

export const meta = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
}: Route.MetaArgs) => {
  return [
    { title: "招待管理 - Cloudflare Mailbox" },
    {
      name: "description",
      content: "ユーザー招待URLの生成と管理",
    },
  ];
};

export default () => {
  const { total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">招待URL管理</h1>
          <p className="text-gray-600 mt-2">招待数: {total}</p>
        </div>
        <a
          href="/admin"
          className="px-4 py-2 bg-gray-500 text-white no-underline rounded-md hover:bg-gray-600 transition-colors"
        >
          ダッシュボードに戻る
        </a>
      </header>

      {actionData?.error && (
        <div className="text-red-600 bg-red-50 p-4 rounded-md mb-4">
          {actionData.error}
        </div>
      )}

      {actionData?.success && actionData.invite && (
        <div className="text-green-700 bg-green-50 border border-green-200 p-4 rounded-md mb-4">
          <h4 className="font-semibold mb-2">招待URL生成完了</h4>
          <p className="mb-2 break-all">
            <strong>URL:</strong> {actionData.invite.url}
          </p>
          <p className="text-sm text-green-600">
            有効期限:{" "}
            {new Date(actionData.invite.expiresAt).toLocaleString("ja-JP")}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">新しい招待URL生成</h2>
        <Form method="post">
          <div className="mb-4">
            <label
              htmlFor="expiresInHours"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              有効期限（時間）:
            </label>
            <select
              id="expiresInHours"
              name="expiresInHours"
              defaultValue="24"
              className="px-3 py-2 border border-gray-300 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              disabled={isSubmitting}
            >
              <option value="1">1時間</option>
              <option value="6">6時間</option>
              <option value="24">24時間</option>
              <option value="72">3日</option>
              <option value="168">1週間</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-6 py-3 text-white font-medium rounded-md text-base transition-all ${
              isSubmitting
                ? "bg-blue-400 cursor-not-allowed opacity-60"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            }`}
          >
            {isSubmitting ? "生成中..." : "招待URL生成"}
          </button>
        </Form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">招待一覧</h2>
        <p className="text-gray-600 italic">
          招待一覧機能は実装中です。現在の招待数: {total}
        </p>
      </div>
    </div>
  );
};
