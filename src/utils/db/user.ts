import { getPrismaClient } from "./index";
import type { User as ZodUser } from "../schema";

export const UserDB = {
  async get(userId: string): Promise<ZodUser | null> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedEmails: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      managedEmails: user.managedEmails.map((me) => me.email),
      passwordHash: user.passwordHash,
      createdAt: Number(user.createdAt),
      lastLogin: user.lastLogin ? Number(user.lastLogin) : undefined,
    };
  },

  async set(userId: string, userData: ZodUser): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.$transaction(async (tx) => {
      // ユーザー情報をupsert
      await tx.user.upsert({
        where: { id: userId },
        create: {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          createdAt: BigInt(userData.createdAt),
          lastLogin: userData.lastLogin ? BigInt(userData.lastLogin) : null,
        },
        update: {
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          lastLogin: userData.lastLogin ? BigInt(userData.lastLogin) : null,
        },
      });

      // 既存の管理メールアドレスを削除
      await tx.userManagedEmail.deleteMany({
        where: { userId },
      });

      // 新しい管理メールアドレスを追加
      if (userData.managedEmails.length > 0) {
        await tx.userManagedEmail.createMany({
          data: userData.managedEmails.map((email, index) => ({
            userId,
            email,
            isPrimary: index === 0, // 最初のメールアドレスをプライマリとする
            createdAt: BigInt(Date.now()),
          })),
        });
      }
    });
  },

  async getByUsername(username: string): Promise<ZodUser | null> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        managedEmails: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      managedEmails: user.managedEmails.map((me) => me.email),
      passwordHash: user.passwordHash,
      createdAt: Number(user.createdAt),
      lastLogin: user.lastLogin ? Number(user.lastLogin) : undefined,
    };
  },

  async list(): Promise<ZodUser[]> {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      include: {
        managedEmails: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      managedEmails: user.managedEmails.map((me) => me.email),
      passwordHash: user.passwordHash,
      createdAt: Number(user.createdAt),
      lastLogin: user.lastLogin ? Number(user.lastLogin) : undefined,
    }));
  },

  async delete(userId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.user.delete({
      where: { id: userId },
    });
  },

  async count(): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.user.count();
  },

  async updateLastLogin(userId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: BigInt(Date.now()) },
    });
  },
};
