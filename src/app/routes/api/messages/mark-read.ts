import type { Route } from "./+types/mark-read";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, InboxKV } from "~/utils/kv";
import { SafeFormData } from "~/app/utils/formdata";
import { z } from "zod";

const messageIdsSchema = z.array(z.string());

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.cloudflare;

  try {
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return new Response("認証が必要です", { status: 401 });
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return new Response("セッションが無効です", { status: 401 });
    }

    const formData = SafeFormData.fromObject(await request.formData());
    const messageIdsJson = formData.get("messageIds");
    const mailbox = formData.get("mailbox");

    if (!messageIdsJson || !mailbox) {
      return new Response("必須パラメータが不足しています", { status: 400 });
    }

    const parseResult = messageIdsSchema.safeParse(JSON.parse(messageIdsJson));

    if (!parseResult.success) {
      return new Response("不正なメッセージIDの形式です", { status: 400 });
    }

    const messageIds = parseResult.data;

    if (!kvSession.managedEmails.includes(mailbox)) {
      return new Response("このメールボックスへのアクセス権限がありません", {
        status: 403,
      });
    }

    const messages = await InboxKV.get(env.MAILBOXES_KV, mailbox);
    const updatedMessages = messages.map((msg) => {
      if (messageIds.includes(msg.messageId)) {
        return {
          ...msg,
          isRead: true,
          readAt: Date.now(),
        };
      }
      return msg;
    });

    await InboxKV.set(env.MAILBOXES_KV, mailbox, updatedMessages);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: messageIds.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Failed to mark messages as read:", error);
    return new Response("既読処理に失敗しました", { status: 500 });
  }
};
