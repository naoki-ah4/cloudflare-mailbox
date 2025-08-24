import { getPrismaClient } from "./index";

export interface OutboxMessage {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    r2Key: string;
    size: number;
  }>;
  sentAt: string;
  resendId: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  status: "sent" | "failed" | "bounced";
}

export const OutboxDB = {
  async get(userId: string): Promise<OutboxMessage[]> {
    const prisma = getPrismaClient();
    const sentEmails = await prisma.sentEmail.findMany({
      where: { userId },
      include: {
        recipients: true,
        attachments: true,
        references: true,
      },
      orderBy: { sentAt: "desc" },
    });

    return sentEmails.map((email) => {
      const toRecipients = email.recipients
        .filter((r) => r.type === "to")
        .map((r) => r.email);
      const ccRecipients = email.recipients
        .filter((r) => r.type === "cc")
        .map((r) => r.email);
      const bccRecipients = email.recipients
        .filter((r) => r.type === "bcc")
        .map((r) => r.email);

      return {
        id: email.id,
        userId: email.userId,
        from: email.from,
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject: email.subject,
        text: email.text || undefined,
        html: email.html || undefined,
        attachments: email.attachments.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          r2Key: att.r2Key,
          size: att.size,
        })),
        sentAt: email.sentAt,
        resendId: email.resendId,
        threadId: email.threadId || undefined,
        inReplyTo: email.inReplyTo || undefined,
        references: email.references.map((ref) => ref.reference),
        status:
          email.status === "sent" ||
          email.status === "failed" ||
          email.status === "bounced"
            ? email.status
            : ("sent" as const),
      };
    });
  },

  async set(userId: string, emails: OutboxMessage[]): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // 既存の送信済みメールを削除
      await tx.sentEmail.deleteMany({
        where: { userId },
      });

      // 新しい送信済みメールを追加
      for (const emailItem of emails) {
        const sentEmail = await tx.sentEmail.create({
          data: {
            id: emailItem.id,
            userId,
            from: emailItem.from,
            subject: emailItem.subject,
            text: emailItem.text ?? null,
            html: emailItem.html ?? null,
            sentAt: emailItem.sentAt,
            resendId: emailItem.resendId,
            threadId: emailItem.threadId ?? null,
            inReplyTo: emailItem.inReplyTo ?? null,
            status: emailItem.status,
          },
        });

        // 受信者を追加
        const recipientData = [
          ...emailItem.to.map((emailAddr) => ({
            sentEmailId: sentEmail.id,
            email: emailAddr,
            type: "to",
          })),
          ...(emailItem.cc || []).map((emailAddr) => ({
            sentEmailId: sentEmail.id,
            email: emailAddr,
            type: "cc",
          })),
          ...(emailItem.bcc || []).map((emailAddr) => ({
            sentEmailId: sentEmail.id,
            email: emailAddr,
            type: "bcc",
          })),
        ];

        if (recipientData.length > 0) {
          await tx.sentEmailRecipient.createMany({
            data: recipientData,
          });
        }

        // 添付ファイルを追加
        if (emailItem.attachments.length > 0) {
          await tx.sentEmailAttachment.createMany({
            data: emailItem.attachments.map((att) => ({
              sentEmailId: sentEmail.id,
              filename: att.filename,
              contentType: att.contentType,
              r2Key: att.r2Key,
              size: att.size,
            })),
          });
        }

        // リファレンスを追加
        if (emailItem.references && emailItem.references.length > 0) {
          await tx.sentEmailReference.createMany({
            data: emailItem.references.map((ref) => ({
              sentEmailId: sentEmail.id,
              reference: ref,
            })),
          });
        }
      }
    });
  },

  async addMessage(userId: string, emailItem: OutboxMessage): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // 送信済みメールを作成
      const sentEmail = await tx.sentEmail.create({
        data: {
          id: emailItem.id,
          userId,
          from: emailItem.from,
          subject: emailItem.subject,
          text: emailItem.text ?? null,
          html: emailItem.html ?? null,
          sentAt: new Date(emailItem.sentAt),
          resendId: emailItem.resendId,
          threadId: emailItem.threadId ?? null,
          inReplyTo: emailItem.inReplyTo ?? null,
          status: emailItem.status,
        },
      });

      // 受信者を追加
      const recipientData = [
        ...emailItem.to.map((emailAddr) => ({
          sentEmailId: sentEmail.id,
          email: emailAddr,
          type: "to",
        })),
        ...(emailItem.cc || []).map((emailAddr) => ({
          sentEmailId: sentEmail.id,
          email: emailAddr,
          type: "cc",
        })),
        ...(emailItem.bcc || []).map((emailAddr) => ({
          sentEmailId: sentEmail.id,
          email: emailAddr,
          type: "bcc",
        })),
      ];

      if (recipientData.length > 0) {
        await tx.sentEmailRecipient.createMany({
          data: recipientData,
        });
      }

      // 添付ファイルを追加
      if (emailItem.attachments.length > 0) {
        await tx.sentEmailAttachment.createMany({
          data: emailItem.attachments.map((att) => ({
            sentEmailId: sentEmail.id,
            filename: att.filename,
            contentType: att.contentType,
            r2Key: att.r2Key,
            size: att.size,
          })),
        });
      }

      // リファレンスを追加
      if (emailItem.references && emailItem.references.length > 0) {
        await tx.sentEmailReference.createMany({
          data: emailItem.references.map((ref) => ({
            sentEmailId: sentEmail.id,
            reference: ref,
          })),
        });
      }
    });
  },

  async delete(userId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.sentEmail.deleteMany({
      where: { userId },
    });
  },

  async count(userId: string): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.sentEmail.count({
      where: { userId },
    });
  },
};
