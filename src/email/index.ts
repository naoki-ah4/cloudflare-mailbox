import PostalMime from "postal-mime";
import { maxAttachmentsSize } from "../utils/size";
import { saveAttachments } from "./attachments";
import { saveEmailToKV, updateInboxIndex } from "./storage";
import { createEmailMessage } from "./utils";
import { SystemKV } from "../utils/kv/system";

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
    console.error("Error checking email processing:", error);
    // エラー時は安全側に倒して拒否
    return { allowed: false };
  }
};

const emailHandler = async (
  message: ForwardableEmailMessage,
  env: Cloudflare.Env
) => {
  try {
    const messageId = crypto.randomUUID();
    const parsedEmail = await PostalMime.parse(message.raw);

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
        console.log(
          `Email redirected to catch-all. Original To: ${toEmails.join(", ")}, Catch-all: ${processingResult.catchAllAddress}`
        );
        // toEmailsをcatch-allアドレスに置き換え
        toEmails.length = 0;
        toEmails.push(processingResult.catchAllAddress);
      } else {
        // 拒否の場合
        console.log(
          `Email rejected - not in allowlist. To: ${toEmails.join(", ")}`
        );
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
      attachments
    );

    await saveEmailToKV(emailMessage, env.MESSAGES_KV);
    await updateInboxIndex(emailMessage, env.MAILBOXES_KV, {
      catchAllAddress: processingResult.catchAllAddress,
    });

    console.log(
      `Email processed successfully. To: ${toEmails.join(", ")}, MessageId: ${messageId}`
    );
  } catch (error) {
    console.error("Error processing email:", error);
  }
};

export default {
  email: emailHandler,
};
