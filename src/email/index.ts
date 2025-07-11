import PostalMime, { type Email } from "postal-mime";
import { maxAttachmentsSize } from "../utils/size";
import { saveAttachments } from "./attachments";
import {
  forwardEmailWithSendEmail,
  saveEmailToKV,
  updateInboxIndex,
} from "./storage";
import { createEmailMessage } from "./utils";
import { SystemKV } from "../utils/kv/system";
import { logger } from "../utils/logger";
import { z } from "zod";

/**
 * メール受信処理の判定結果
 */
interface EmailProcessingResult {
  allowed: boolean;
  catchAllAddress?: string;
}

/**
 * 受信可能メールアドレスかどうかをチェックし、処理方法を決定する
 */
const checkEmailProcessing = async (
  toEmails: string[],
  systemKV: KVNamespace
): Promise<EmailProcessingResult> => {
  try {
    const systemSettings = await SystemKV.getSettings(systemKV);

    // システム設定が存在しない、または受信可能アドレスが空の場合は全て許可
    if (!systemSettings || systemSettings.allowedEmailAddresses.length === 0) {
      return { allowed: true };
    }

    // toEmailsのいずれかが許可リストに含まれているかチェック
    const isAllowed = toEmails.some((email) =>
      systemSettings.allowedEmailAddresses.includes(email.toLowerCase())
    );

    if (isAllowed) {
      return { allowed: true };
    }

    // 許可されていない場合の処理方法を決定
    if (
      systemSettings.unauthorizedEmailHandling === "CATCH_ALL" &&
      systemSettings.catchAllEmailAddress
    ) {
      return {
        allowed: false,
        catchAllAddress: systemSettings.catchAllEmailAddress,
      };
    } else {
      return { allowed: false }; // REJECT
    }
  } catch (error) {
    logger.error("メール処理チェックエラー", { error: error as Error });
    // エラー時は安全側に倒して拒否
    return { allowed: false };
  }
};

const emailHandler = async (
  message: ForwardableEmailMessage,
  env: Cloudflare.Env
) => {
  let parsedEmail: Email | null = null;

  try {
    const messageId = crypto.randomUUID();
    parsedEmail = await PostalMime.parse(message.raw);

    // 受信可能メールアドレスかチェック（createEmailMessageと同じロジック）
    const toEmails: string[] =
      parsedEmail.to
        ?.map((addr) => addr.address)
        .filter((addr) => typeof addr === "string") || [];

    const processingResult = await checkEmailProcessing(
      toEmails,
      env.SYSTEM_KV
    );
    if (!processingResult.allowed) {
      if (processingResult.catchAllAddress) {
        // catch-all転送の場合、転送先アドレスに変更して処理続行
        logger.emailLog("メールをcatch-allアドレスに転送", {
          originalTo: toEmails.join(", "),
          catchAllAddress: processingResult.catchAllAddress,
        });
      } else {
        // 拒否の場合
        logger.emailLog("メール受信拒否: 許可リストに含まれていない", {
          toEmails: toEmails.join(", "),
        });
        return; // 受信を拒否
      }
    }

    const attachmentsSizeLimit = maxAttachmentsSize(env);
    const attachments = await saveAttachments(
      parsedEmail.attachments || [],
      messageId,
      env.ATTACHMENTS_R2,
      attachmentsSizeLimit
    );
    const emailMessage = createEmailMessage(
      parsedEmail,
      messageId,
      attachments,
      message,
      !processingResult.allowed && !!processingResult.catchAllAddress
    );

    await saveEmailToKV(emailMessage, env.MESSAGES_KV);
    await updateInboxIndex(emailMessage, env.MAILBOXES_KV, {
      catchAllAddress: processingResult.catchAllAddress,
    });

    logger.emailLog("メール処理完了", {
      toEmails: toEmails.join(", "),
      messageId,
      subject: emailMessage.subject,
      from: emailMessage.from,
      attachmentCount: attachments.length,
    });
  } catch (error) {
    logger.error("メール処理エラー", { error });
  }
  if (env.FORWARD_EMAIL_ADDRESS && env.SEND_EMAIL) {
    const forwardTo = await z
      .string()
      .email()
      .safeParseAsync(env.FORWARD_EMAIL_ADDRESS);
    if (forwardTo.success) {
      try {
        await forwardEmailWithSendEmail(
          parsedEmail,
          message,
          forwardTo.data,
          env
        );
        logger.emailLog("メール送信完了", {
          to: forwardTo.data,
          from: message.from,
          subject: parsedEmail?.subject || "",
        });
      } catch (error) {
        logger.error("メール送信エラー", {
          error,
          to: forwardTo.data,
          from: message.from,
          subject: parsedEmail?.subject || message.headers.get("subject") || "",
        });
      }
    }
  }
};

export default {
  email: emailHandler,
};
