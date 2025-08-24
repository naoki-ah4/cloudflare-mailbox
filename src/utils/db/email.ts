import { getPrismaClient } from "./index";
import type {
  EmailMessage as ZodEmailMessage,
  EmailMetadata as ZodEmailMetadata,
} from "../schema";
import { transformEmailMessage, transformEmailMetadata } from "./transforms";

export const MessageDB = {
  async get(messageId: string): Promise<ZodEmailMessage | null> {
    const prisma = getPrismaClient();
    const message = await prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        recipients: true,
        attachments: true,
        references: true,
      },
    });

    if (!message) return null;

    return transformEmailMessage(message);
  },

  async set(messageId: string, messageData: ZodEmailMessage): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // メッセージをupsert
      await tx.emailMessage.upsert({
        where: { id: messageId },
        create: {
          id: messageData.id,
          from: messageData.from,
          subject: messageData.subject,
          date: messageData.date,
          text: messageData.text,
          html: messageData.html,
          threadId: messageData.threadId,
          inReplyTo: messageData.inReplyTo,
          originalFrom: messageData.originalFrom,
          isCatchAll: messageData.isCatchAll,
        },
        update: {
          from: messageData.from,
          subject: messageData.subject,
          date: messageData.date,
          text: messageData.text,
          html: messageData.html,
          threadId: messageData.threadId,
          inReplyTo: messageData.inReplyTo,
          originalFrom: messageData.originalFrom,
          isCatchAll: messageData.isCatchAll,
        },
      });

      // 既存のリレーションを削除
      await tx.emailRecipient.deleteMany({ where: { messageId } });
      await tx.emailAttachment.deleteMany({ where: { messageId } });
      await tx.emailReference.deleteMany({ where: { messageId } });

      // 受信者を追加
      if (messageData.to.length > 0) {
        await tx.emailRecipient.createMany({
          data: messageData.to.map((email) => ({
            messageId,
            email,
            type: "to",
          })),
        });
      }

      // 添付ファイルを追加
      if (messageData.attachments.length > 0) {
        await tx.emailAttachment.createMany({
          data: messageData.attachments.map((att) => ({
            messageId,
            filename: att.filename,
            contentType: att.contentType,
            r2Key: att.r2Key,
            size: att.size,
          })),
        });
      }

      // リファレンスを追加
      if (messageData.references && messageData.references.length > 0) {
        await tx.emailReference.createMany({
          data: messageData.references.map((ref) => ({
            messageId,
            reference: ref,
          })),
        });
      }
    });
  },

  async delete(messageId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.emailMessage.delete({
      where: { id: messageId },
    });
  },

  async count(): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.emailMessage.count();
  },
};

export const InboxDB = {
  async get(recipient: string, folderId?: string): Promise<ZodEmailMetadata[]> {
    const prisma = getPrismaClient();
    const metadata = await prisma.emailMetadata.findMany({
      where: {
        recipient,
        folderId: folderId || null,
      },
      include: {
        message: {
          include: {
            recipients: {
              where: { type: "to" },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return metadata.map(transformEmailMetadata);
  },

  async addMessage(
    recipient: string,
    metadata: ZodEmailMetadata,
    folderId?: string
  ): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.emailMetadata.create({
      data: {
        messageId: metadata.messageId,
        recipient,
        from: metadata.from,
        subject: metadata.subject,
        date: metadata.date,
        hasAttachments: metadata.hasAttachments,
        size: metadata.size,
        threadId: metadata.threadId,
        isRead: metadata.isRead || false,
        readAt: metadata.readAt ? BigInt(metadata.readAt) : null,
        originalFrom: metadata.originalFrom,
        folderId,
      },
    });
  },

  async updateReadStatus(
    recipient: string,
    messageId: string,
    isRead: boolean
  ): Promise<boolean> {
    const prisma = getPrismaClient();

    try {
      await prisma.emailMetadata.updateMany({
        where: {
          recipient,
          messageId,
        },
        data: {
          isRead,
          readAt: isRead ? BigInt(Date.now()) : null,
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  async bulkMarkAsRead(
    recipient: string,
    messageIds: string[]
  ): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.emailMetadata.updateMany({
      where: {
        recipient,
        messageId: { in: messageIds },
      },
      data: {
        isRead: true,
        readAt: BigInt(Date.now()),
      },
    });

    return result.count;
  },

  async getStats(
    recipient: string
  ): Promise<{ total: number; unread: number }> {
    const prisma = getPrismaClient();

    const [total, unread] = await Promise.all([
      prisma.emailMetadata.count({ where: { recipient } }),
      prisma.emailMetadata.count({ where: { recipient, isRead: false } }),
    ]);

    return { total, unread };
  },

  async set(recipient: string, messages: ZodEmailMetadata[]): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // 既存のメタデータを削除
      await tx.emailMetadata.deleteMany({
        where: { recipient },
      });

      // 新しいメタデータを作成
      if (messages.length > 0) {
        await tx.emailMetadata.createMany({
          data: messages.map((metadata) => ({
            messageId: metadata.messageId,
            recipient,
            from: metadata.from,
            subject: metadata.subject,
            date: metadata.date,
            hasAttachments: metadata.hasAttachments,
            size: metadata.size,
            threadId: metadata.threadId,
            isRead: metadata.isRead || false,
            readAt: metadata.readAt ? BigInt(metadata.readAt) : null,
            originalFrom: metadata.originalFrom,
          })),
        });
      }
    });
  },

  async getMultipleStats(
    recipients: string[]
  ): Promise<{ [email: string]: { total: number; unread: number } }> {
    const results: { [email: string]: { total: number; unread: number } } = {};

    await Promise.all(
      recipients.map(async (recipient) => {
        const stats = await this.getStats(recipient);
        results[recipient] = stats;
      })
    );

    return results;
  },

  async moveToFolder(
    recipient: string,
    messageIds: string[],
    folderId: string
  ): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.emailMetadata.updateMany({
      where: {
        recipient,
        messageId: { in: messageIds },
      },
      data: {
        folderId,
      },
    });

    return result.count;
  },

  async deleteMessages(
    recipient: string,
    messageIds: string[]
  ): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.emailMetadata.deleteMany({
      where: {
        recipient,
        messageId: { in: messageIds },
      },
    });

    return result.count;
  },
};

export const ThreadDB = {
  async get(threadId: string): Promise<string[]> {
    const prisma = getPrismaClient();
    const messages = await prisma.emailMessage.findMany({
      where: { threadId },
      select: { id: true },
      orderBy: { date: "asc" },
    });

    return messages.map((msg) => msg.id);
  },

  async set(threadId: string, messageIds: string[]): Promise<void> {
    const prisma = getPrismaClient();

    // スレッドを作成（存在しない場合）
    await prisma.thread.upsert({
      where: { id: threadId },
      create: { id: threadId },
      update: {},
    });

    // メッセージのthreadIdを更新
    await prisma.emailMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { threadId },
    });
  },

  async addMessage(threadId: string, messageId: string): Promise<void> {
    const prisma = getPrismaClient();

    // スレッドを作成（存在しない場合）
    await prisma.thread.upsert({
      where: { id: threadId },
      create: { id: threadId },
      update: {},
    });

    // メッセージのthreadIdを更新
    await prisma.emailMessage.update({
      where: { id: messageId },
      data: { threadId },
    });
  },

  async delete(threadId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.thread.delete({
      where: { id: threadId },
    });
  },
};
