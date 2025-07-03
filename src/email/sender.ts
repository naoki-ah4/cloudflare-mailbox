/**
 * メール送信機能
 * Resend APIを使用したメール送信とCloudflare Workers統合
 * https://resend.com/docs/api-reference/emails/send-email
 */

import { logger } from "~/utils/logger";
import type { EmailAttachment } from "~/email/types";
import { Resend, type CreateEmailOptions } from "resend";
import type { SendEmailRequest } from "~/utils/kv/schema";

export type SendEmailResult = {
  id: string;
  success: boolean;
  error?: string;
};

/**
 * Resend APIを使用してメールを送信
 */
export const sendEmailViaResend = async (
  emailData: SendEmailRequest,
  resendApiKey: string,
  env: Env
): Promise<SendEmailResult> => {
  try {
    // API キーの確認
    if (!resendApiKey || resendApiKey.trim() === "") {
      throw new Error("Resend API キーが設定されていません");
    }
    // 添付ファイルの処理
    const attachments = await Promise.all(
      (emailData.attachments || []).map(async (attachment) => {
        try {
          // R2から添付ファイルを取得
          const r2Object = await env.ATTACHMENTS_R2.get(attachment.r2Key);
          if (!r2Object) {
            throw new Error(
              `添付ファイルが見つかりません: ${attachment.filename}`
            );
          }

          const arrayBuffer = await r2Object.arrayBuffer();
          const base64Content = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuffer))
          );

          return {
            filename: attachment.filename,
            content: base64Content,
            type: attachment.contentType,
          };
        } catch (error) {
          logger.error("添付ファイル処理エラー", {
            error: error as Error,
            context: { filename: attachment.filename, r2Key: attachment.r2Key },
          });
          throw error;
        }
      })
    );

    // Resend APIリクエスト
    const resendPayload: CreateEmailOptions = {
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      text: emailData.text || "",
      html: emailData.html,
      attachments: attachments.length > 0 ? attachments : undefined,
      headers: {
        ...(emailData.inReplyTo && { "In-Reply-To": emailData.inReplyTo }),
        ...(emailData.references && {
          References: emailData.references.join(" "),
        }),
      },
    };

    logger.info("Resend API送信開始", {
      context: {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        attachmentCount: attachments.length,
      },
    });

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send(resendPayload);

    if (error) {
      throw new Error(`Resend API error: ${error.name} ${error.message}`);
    }

    if (!data || !data.id) {
      throw new Error("Resend APIからの応答にIDが含まれていません");
    }

    logger.info("Resend API送信成功", {
      context: {
        resendId: data.id,
        from: emailData.from,
        to: emailData.to,
      },
    });

    return {
      id: data.id,
      success: true,
    };
  } catch (error) {
    logger.error("メール送信エラー", {
      error: error as Error,
      context: {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
      },
    });

    return {
      id: "",
      success: false,
      error: (error as Error).message,
    };
  }
};

/**
 * 送信者アドレスの検証
 */
export const validateSenderAddress = (
  fromAddress: string,
  managedEmails: string[]
): boolean => {
  return managedEmails.includes(fromAddress.toLowerCase());
};

/**
 * 受信者アドレスの検証
 */
export const validateRecipients = (recipients: string[]): boolean => {
  if (recipients.length === 0) {
    return false;
  }

  // 基本的なメールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return recipients.every((email) => emailRegex.test(email));
};

/**
 * 添付ファイルのサイズ制限チェック
 */
export const validateAttachmentSize = (
  attachments: EmailAttachment[],
  maxSizePerFile = 25 * 1024 * 1024, // 25MB per file
  maxTotalSize = 25 * 1024 * 1024 // 25MB total
): { valid: boolean; error?: string } => {
  if (!attachments || attachments.length === 0) {
    return { valid: true };
  }

  // 個別ファイルサイズチェック
  for (const attachment of attachments) {
    if (attachment.size > maxSizePerFile) {
      return {
        valid: false,
        error: `ファイル "${attachment.filename}" のサイズが制限を超えています (${Math.round(attachment.size / 1024 / 1024)}MB > ${Math.round(maxSizePerFile / 1024 / 1024)}MB)`,
      };
    }
  }

  // 合計サイズチェック
  const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      error: `添付ファイルの合計サイズが制限を超えています (${Math.round(totalSize / 1024 / 1024)}MB > ${Math.round(maxTotalSize / 1024 / 1024)}MB)`,
    };
  }

  // ファイル数制限（10個まで）
  if (attachments.length > 10) {
    return {
      valid: false,
      error: `添付ファイル数が制限を超えています (${attachments.length}個 > 10個)`,
    };
  }

  return { valid: true };
};

/**
 * 添付ファイルの拡張子チェック
 */
export const validateAttachmentTypes = (
  attachments: EmailAttachment[]
): { valid: boolean; error?: string } => {
  if (!attachments || attachments.length === 0) {
    return { valid: true };
  }

  // 危険な拡張子のブラックリスト
  const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".pif",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
    ".msi",
    ".dll",
    ".sys",
    ".bin",
    ".app",
    ".deb",
    ".rpm",
    ".sh",
    ".ps1",
  ];

  for (const attachment of attachments) {
    const filename = attachment.filename.toLowerCase();
    const hasDangerousExtension = dangerousExtensions.some((ext) =>
      filename.endsWith(ext)
    );

    if (hasDangerousExtension) {
      return {
        valid: false,
        error: `ファイル "${attachment.filename}" は安全性の理由により送信できません`,
      };
    }
  }

  return { valid: true };
};

/**
 * スレッド関連ヘッダーの生成
 */
export const generateThreadHeaders = (originalMessage?: {
  messageId: string;
  threadId?: string;
  references?: string[];
}): { inReplyTo?: string; references?: string[] } => {
  if (!originalMessage) {
    return {};
  }

  const references = originalMessage.references || [];
  const newReferences = [...references];

  // Message-IDを参照に追加（重複を避ける）
  if (!newReferences.includes(originalMessage.messageId)) {
    newReferences.push(originalMessage.messageId);
  }

  return {
    inReplyTo: originalMessage.messageId,
    references: newReferences,
  };
};

/**
 * HTMLメールの安全性チェック
 */
export const sanitizeHtmlContent = (html: string): string => {
  // 基本的なHTMLサニタイゼーション（簡易版）
  // 本格的な実装では DOMPurify などを使用することを推奨
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
};
