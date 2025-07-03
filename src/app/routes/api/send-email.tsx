/**
 * メール送信APIエンドポイント
 * POST /api/send-email
 */

import type { ActionFunctionArgs } from "react-router";
import { getUserSession } from "~/utils/session.server";
import { SessionKV, RateLimitKV } from "~/utils/kv";
import { OutboxKV } from "~/utils/kv/outbox";
import { DraftKV } from "~/utils/kv/draft";
import {
  sendEmailViaResend,
  validateSenderAddress,
  validateRecipients,
  validateAttachmentSize,
  validateAttachmentTypes,
  sanitizeHtmlContent,
} from "~/email/sender";
import type { SendEmailRequest } from "~/email/sender";
import { logger } from "~/utils/logger";
import { v4 as uuidv4 } from "uuid";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;

  try {
    // セッション認証
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "認証が必要です" }, { status: 401 });
    }

    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return Response.json({ error: "セッションが無効です" }, { status: 401 });
    }

    // リクエストデータの解析
    const formData = await request.formData();
    const fromValue = formData.get("from");
    const toValue = formData.get("to");
    const ccValue = formData.get("cc");
    const bccValue = formData.get("bcc");
    const subjectValue = formData.get("subject");
    const textValue = formData.get("text");
    const htmlValue = formData.get("html");
    const attachmentsValue = formData.get("attachments");
    const inReplyToValue = formData.get("inReplyTo");
    const referencesValue = formData.get("references");

    const requestData: SendEmailRequest = {
      from: fromValue as string,
      to: toValue ? JSON.parse(toValue as string) as string[] : [],
      cc: ccValue ? JSON.parse(ccValue as string) as string[] : undefined,
      bcc: bccValue ? JSON.parse(bccValue as string) as string[] : undefined,
      subject: subjectValue as string,
      text: textValue as string,
      html: htmlValue as string,
      attachments: attachmentsValue 
        ? JSON.parse(attachmentsValue as string) 
        : undefined,
      inReplyTo: inReplyToValue as string || undefined,
      references: referencesValue 
        ? JSON.parse(referencesValue as string) as string[]
        : undefined,
    };

    // バリデーション
    if (!requestData.from || !requestData.to || !requestData.subject) {
      return Response.json(
        { error: "必須フィールドが不足しています" },
        { status: 400 }
      );
    }

    // 送信者アドレス検証
    if (!validateSenderAddress(requestData.from, kvSession.managedEmails)) {
      return Response.json(
        { error: "送信者アドレスが許可されていません" },
        { status: 403 }
      );
    }

    // 受信者アドレス検証
    const allRecipients = [
      ...requestData.to,
      ...(requestData.cc || []),
      ...(requestData.bcc || []),
    ];
    
    if (!validateRecipients(allRecipients)) {
      return Response.json(
        { error: "無効な受信者アドレスが含まれています" },
        { status: 400 }
      );
    }

    // 添付ファイルサイズ検証
    if (requestData.attachments) {
      const sizeValidation = validateAttachmentSize(requestData.attachments);
      if (!sizeValidation.valid) {
        return Response.json(
          { error: sizeValidation.error },
          { status: 400 }
        );
      }

      // 添付ファイル拡張子検証
      const typeValidation = validateAttachmentTypes(requestData.attachments);
      if (!typeValidation.valid) {
        return Response.json(
          { error: typeValidation.error },
          { status: 400 }
        );
      }
    }

    // RESEND API キーの確認
    if (!env.RESEND_API_KEY) {
      logger.error("RESEND_API_KEY が設定されていません", {
        context: { userEmail: kvSession.email },
      });
      return Response.json(
        { error: "メール送信サービスが設定されていません" },
        { status: 500 }
      );
    }

    // レート制限チェック
    const rateLimitKey = `email_send:${kvSession.email}`;
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
    const rateLimit = await RateLimitKV.checkRateLimit(
      env.USERS_KV,
      rateLimitKey,
      currentHour,
      10 // 1時間に10通まで
    );

    if (!rateLimit.allowed) {
      return Response.json(
        { 
          error: "送信制限に達しました", 
          retryAfter: rateLimit.retryAfter 
        },
        { status: 429 }
      );
    }

    // HTMLコンテンツのサニタイゼーション
    const sanitizedHtml = requestData.html 
      ? sanitizeHtmlContent(requestData.html)
      : undefined;

    // 送信データの準備
    const emailToSend: SendEmailRequest = {
      ...requestData,
      html: sanitizedHtml,
    };

    // Resend APIで送信
    const sendResult = await sendEmailViaResend(
      emailToSend,
      env.RESEND_API_KEY,
      env
    );

    if (!sendResult.success) {
      logger.error("メール送信失敗", {
        context: {
          userEmail: kvSession.email,
          from: requestData.from,
          to: requestData.to,
          error: sendResult.error,
        },
      });

      return Response.json(
        { error: "メール送信に失敗しました: " + sendResult.error },
        { status: 500 }
      );
    }

    // 送信履歴を保存
    const sentEmail = {
      id: uuidv4(),
      from: requestData.from,
      to: requestData.to,
      cc: requestData.cc || [],
      bcc: requestData.bcc || [],
      subject: requestData.subject,
      text: requestData.text,
      html: sanitizedHtml,
      attachments: requestData.attachments || [],
      sentAt: new Date().toISOString(),
      resendId: sendResult.id,
      threadId: requestData.inReplyTo ? undefined : uuidv4(), // 新規スレッドまたは返信
      inReplyTo: requestData.inReplyTo,
      references: requestData.references || [],
      status: "sent" as const,
    };

    await OutboxKV.saveSentEmail(env.USERS_KV, kvSession.email, sentEmail);

    // 下書きがある場合は削除
    const draftId = formData.get("draftId") as string;
    if (draftId) {
      await DraftKV.deleteDraft(env.USERS_KV, kvSession.email, draftId);
    }

    // レート制限を更新
    await RateLimitKV.updateRateLimit(
      env.USERS_KV,
      rateLimitKey,
      currentHour
    );

    logger.info("メール送信成功", {
      context: {
        userEmail: kvSession.email,
        sentEmailId: sentEmail.id,
        resendId: sendResult.id,
        from: requestData.from,
        to: requestData.to,
        recipientCount: allRecipients.length,
      },
    });

    return Response.json({
      success: true,
      sentEmailId: sentEmail.id,
      resendId: sendResult.id,
      message: "メールを送信しました",
    });

  } catch (error) {
    logger.error("メール送信APIエラー", {
      error: error as Error,
    });

    return Response.json(
      { error: "内部サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
};