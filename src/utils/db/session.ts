import { getPrismaClient } from "./index";
import type { Session as ZodSession } from "../schema";

export const SessionDB = {
  async get(sessionId: string): Promise<ZodSession | null> {
    const prisma = getPrismaClient();
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sessionManagedEmails: true,
      },
    });

    if (!session) return null;

    // 期限切れチェック
    if (Date.now() > Number(session.expiresAt)) {
      await this.delete(sessionId);
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      email: session.email,
      managedEmails: session.sessionManagedEmails.map((sme) => sme.email),
      createdAt: Number(session.createdAt),
      expiresAt: Number(session.expiresAt),
    };
  },

  async set(sessionId: string, sessionData: ZodSession): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // セッション情報をupsert
      await tx.session.upsert({
        where: { id: sessionId },
        create: {
          id: sessionData.id,
          userId: sessionData.userId,
          email: sessionData.email,
          createdAt: BigInt(sessionData.createdAt),
          expiresAt: BigInt(sessionData.expiresAt),
        },
        update: {
          userId: sessionData.userId,
          email: sessionData.email,
          createdAt: BigInt(sessionData.createdAt),
          expiresAt: BigInt(sessionData.expiresAt),
        },
      });

      // 既存のセッション管理メールアドレスを削除
      await tx.sessionManagedEmail.deleteMany({
        where: { sessionId },
      });

      // 新しいセッション管理メールアドレスを追加
      if (sessionData.managedEmails.length > 0) {
        await tx.sessionManagedEmail.createMany({
          data: sessionData.managedEmails.map((email) => ({
            sessionId,
            email,
          })),
        });
      }
    });
  },

  async delete(sessionId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.session
      .delete({
        where: { id: sessionId },
      })
      .catch(() => {
        // セッションが存在しない場合は無視
      });
  },

  async deleteByUserId(userId: string): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    return result.count;
  },

  async deleteExpired(): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: BigInt(Date.now()),
        },
      },
    });

    return result.count;
  },

  async count(): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.session.count();
  },

  async getByUserId(userId: string): Promise<ZodSession[]> {
    const prisma = getPrismaClient();
    const sessions = await prisma.session.findMany({
      where: { userId },
      include: {
        sessionManagedEmails: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      email: session.email,
      managedEmails: session.sessionManagedEmails.map((sme) => sme.email),
      createdAt: Number(session.createdAt),
      expiresAt: Number(session.expiresAt),
    }));
  },
};
