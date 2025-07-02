import PostalMime from "postal-mime";
import { maxAttachmentsSize } from "../utils/size";
import { saveAttachments } from "./attachments";
import { saveEmailToKV, updateInboxIndex } from "./storage";
import { createEmailMessage } from "./utils";

const emailHandler = async (
  message: ForwardableEmailMessage,
  env: Cloudflare.Env
) => {
  try {
    const messageId = crypto.randomUUID();
    const parsedEmail = await PostalMime.parse(message.raw);

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
  } catch (error) {
    console.error("Error processing email:", error);
  }
};

export default {
  email: emailHandler,
};
