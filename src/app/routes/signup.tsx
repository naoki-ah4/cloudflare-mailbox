import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { UserKV, InviteKV, SessionKV } from "~/utils/kv";
import { validateEmailDomains } from "~/utils/domain-validation";
import { redirect } from "react-router";
import { getUserSession, commitUserSession } from "~/utils/session.server";
import LoadingButton from "~/app/components/elements/LoadingButton";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  const url = new URL(request.url);
  const inviteToken = url.searchParams.get("invite");

  if (!inviteToken) {
    throw new Error("招待トークンが必要です");
  }

  try {
    // 招待トークン検証
    const invite = await InviteKV.get(env.USERS_KV, inviteToken);

    if (!invite) {
      throw new Error("無効な招待URLです");
    }

    if (invite.used) {
      throw new Error("この招待URLは既に使用済みです");
    }

    if (invite.expiresAt < Date.now()) {
      throw new Error("この招待URLは期限切れです");
    }

    return {
      inviteToken,
      inviteValid: true,
    };
  } catch (error) {
    console.error("Invite validation error:", error);
    throw new Error("招待URLの検証に失敗しました");
  }
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  const session = await getUserSession(request.headers.get("Cookie"));

  try {
    const formData = await request.formData();
    const inviteToken = formData.get("inviteToken") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const email = formData.get("email") as string;
    const managedEmailsStr = formData.get("managedEmails") as string;

    // バリデーション
    if (!inviteToken || !username || !password || !email || !managedEmailsStr) {
      return { error: "全ての項目を入力してください" };
    }

    // 招待トークン再検証
    const invite = await InviteKV.get(env.USERS_KV, inviteToken);
    if (!invite || invite.used || invite.expiresAt < Date.now()) {
      return { error: "無効または期限切れの招待URLです" };
    }

    // ユーザー名バリデーション
    if (username.length < 3 || username.length > 30) {
      return { error: "ユーザー名は3〜30文字で入力してください" };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { error: "ユーザー名は英数字とアンダースコアのみ使用できます" };
    }

    // パスワードバリデーション
    if (password.length < 8) {
      return { error: "パスワードは8文字以上で入力してください" };
    }

    // メールアドレス解析
    const managedEmails = managedEmailsStr
      .split("\n")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (managedEmails.length === 0) {
      return { error: "管理するメールアドレスを最低1つ入力してください" };
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const managedEmail of managedEmails) {
      if (!emailRegex.test(managedEmail)) {
        return { error: `無効なメールアドレス形式: ${managedEmail}` };
      }
    }

    if (!emailRegex.test(email)) {
      return { error: "無効な連絡先メールアドレス形式です" };
    }

    // 連絡先メールと管理メールの重複チェック
    if (managedEmails.includes(email)) {
      return {
        error:
          "連絡先メールアドレスと管理メールアドレスは異なるものを指定してください",
      };
    }

    // ドメイン検証（許可ドメインチェック）
    const domainValidation = await validateEmailDomains(
      managedEmails,
      env.SYSTEM_KV
    );
    if (!domainValidation.isValid) {
      return {
        error:
          domainValidation.message ||
          "許可されていないドメインが含まれています",
      };
    }

    // ユーザー名重複チェック
    const existingUser = await UserKV.getByUsername(env.USERS_KV, username);
    if (existingUser) {
      return { error: "そのユーザー名は既に使用されています" };
    }

    // パスワードハッシュ化
    const passwordHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password + "salt")
    );
    const hashHex = Array.from(new Uint8Array(passwordHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // ユーザー作成
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      username,
      email,
      managedEmails,
      passwordHash: hashHex,
      createdAt: Date.now(),
    };

    await UserKV.set(env.USERS_KV, userId, user);

    // 招待トークンを使用済みにマーク
    await InviteKV.markUsed(env.USERS_KV, inviteToken);

    // 自動ログイン - セッション作成（KVに保存）
    const sessionId = crypto.randomUUID();
    const kvSession = {
      id: sessionId,
      userId,
      email: user.email,
      managedEmails: user.managedEmails,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日間
    };

    await SessionKV.set(env.USERS_KV, sessionId, kvSession);

    // React RouterセッションにsessionIdを保存
    session.set("sessionId", sessionId);

    return redirect("/dashboard", {
      headers: {
        "Set-Cookie": await commitUserSession(session),
      },
    });
  } catch (error) {
    console.error("User registration error:", error);
    return { error: "アカウント作成に失敗しました。もう一度お試しください。" };
  }
};

export default () => {
  const { inviteToken } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">ユーザー登録</h1>
      <p className="text-gray-600 mb-8 leading-relaxed">
        招待を受けたメールボックス管理システムへようこそ。
        <br />
        アカウント情報を入力してください。
      </p>

      <Form method="post">
        <input type="hidden" name="inviteToken" value={inviteToken} />

        {actionData?.error && (
          <div className="text-red-600 bg-red-50 p-4 rounded-md mb-4">
            {actionData.error}
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            ユーザー名 *
          </label>
          <input
            type="text"
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            className="w-full px-3 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">
            3〜30文字、英数字とアンダースコアのみ
          </small>
        </div>

        <div className="mb-4">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            パスワード *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            className="w-full px-3 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">8文字以上</small>
        </div>

        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            連絡先メールアドレス *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-3 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">
            システム通知やパスワードリセット用
          </small>
        </div>

        <div className="mb-8">
          <label
            htmlFor="managedEmails"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            管理するメールアドレス *
          </label>
          <textarea
            id="managedEmails"
            name="managedEmails"
            required
            rows={4}
            placeholder="example1@domain.com&#10;example2@domain.com&#10;..."
            className="w-full px-3 py-3 border border-gray-300 rounded-md text-base resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isSubmitting}
          />
          <small className="text-gray-500 text-sm">
            1行に1つずつ入力してください。連絡先メールとは別のアドレスを指定してください。
          </small>
        </div>

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="作成中..."
          variant="primary"
          size="large"
          className="w-full"
        >
          アカウント作成
        </LoadingButton>
      </Form>
    </div>
  );
};
