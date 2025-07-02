import PostalMime from "postal-mime";
import { maxAttachmentsSize } from "../utils/size";
import { saveAttachments } from "./attachments";
import { saveEmailToKV, updateInboxIndex } from "./storage";
import { createEmailMessage } from "./utils";
import { SystemKV } from "../utils/kv/system";

/**
 * 受信可能メールアドレスかどうかをチェックする
 */
const isEmailAllowed = async (
  toEmails: string[],
  systemKV: KVNamespace
): Promise<boolean> => {
  try {
    const systemSettings = await SystemKV.getSettings(systemKV);

    // システム設定が存在しない、または受信可能アドレスが空の場合は全て許可
    if (!systemSettings || systemSettings.allowedEmailAddresses.length === 0) {
      return true;
    }

    // toEmailsのいずれかが許可リストに含まれているかチェック
    return toEmails.some((email) =>
      systemSettings.allowedEmailAddresses.includes(email.toLowerCase())
    );
  } catch (error) {
    console.error("Error checking email allowlist:", error);
    // エラー時は安全側に倒して許可しない
    return false;
  }
};

const emailHandler = async (
  message: ForwardableEmailMessage,
  env: Cloudflare.Env
) => {
  try {
    const messageId = crypto.randomUUID();
    const parsedEmail = await PostalMime.parse(message.raw);

    // 受信可能メールアドレスかチェック
    const toEmails: string[] = Array.isArray(parsedEmail.to)
      ? parsedEmail.to
          .map((addr) => (typeof addr === "string" ? addr : addr.address))
          .filter((email): email is string => Boolean(email))
      : [
          typeof parsedEmail.to === "string"
            ? parsedEmail.to
            : parsedEmail.to?.address,
        ].filter((email): email is string => Boolean(email));

    const isAllowed = await isEmailAllowed(toEmails, env.SYSTEM_KV);
    if (!isAllowed) {
      console.log(
        `Email rejected - not in allowlist. To: ${toEmails.join(", ")}`
      );
      return; // 受信を拒否
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
    await updateInboxIndex(emailMessage, env.MAILBOXES_KV);

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
