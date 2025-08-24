import { getPrismaClient } from "./index";
import type {
  Admin as ZodAdmin,
  AdminSession as ZodAdminSession,
  Invite as ZodInvite,
} from "../schema";

export const AdminDB = {
  async get(adminId: string): Promise<ZodAdmin | null> {
    const prisma = getPrismaClient();
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) return null;

    return {
      id: admin.id,
      username: admin.username,
      passwordHash: admin.passwordHash,
      createdAt: Number(admin.createdAt),
      lastLogin: admin.lastLogin ? Number(admin.lastLogin) : undefined,
    };
  },

  async set(adminId: string, adminData: ZodAdmin): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.admin.upsert({
      where: { id: adminId },
      create: {
        id: adminData.id,
        username: adminData.username,
        passwordHash: adminData.passwordHash,
        createdAt: BigInt(adminData.createdAt),
        lastLogin: adminData.lastLogin ? BigInt(adminData.lastLogin) : null,
      },
      update: {
        username: adminData.username,
        passwordHash: adminData.passwordHash,
        lastLogin: adminData.lastLogin ? BigInt(adminData.lastLogin) : null,
      },
    });
  },

  async getByUsername(username: string): Promise<ZodAdmin | null> {
    const prisma = getPrismaClient();
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) return null;

    return {
      id: admin.id,
      username: admin.username,
      passwordHash: admin.passwordHash,
      createdAt: Number(admin.createdAt),
      lastLogin: admin.lastLogin ? Number(admin.lastLogin) : undefined,
    };
  },

  async list(): Promise<ZodAdmin[]> {
    const prisma = getPrismaClient();
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
    });

    return admins.map((admin) => ({
      id: admin.id,
      username: admin.username,
      passwordHash: admin.passwordHash,
      createdAt: Number(admin.createdAt),
      lastLogin: admin.lastLogin ? Number(admin.lastLogin) : undefined,
    }));
  },

  async delete(adminId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.admin.delete({
      where: { id: adminId },
    });
  },

  async count(): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.admin.count();
  },

  async updateLastLogin(adminId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.admin.update({
      where: { id: adminId },
      data: { lastLogin: BigInt(Date.now()) },
    });
  },
};

export const AdminSessionDB = {
  async get(sessionId: string): Promise<ZodAdminSession | null> {
    const prisma = getPrismaClient();
    const session = await prisma.adminSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return null;

    // 期限切れチェック
    if (Date.now() > Number(session.expiresAt)) {
      await this.delete(sessionId);
      return null;
    }

    return {
      id: session.id,
      adminId: session.adminId,
      createdAt: Number(session.createdAt),
      expiresAt: Number(session.expiresAt),
    };
  },

  async set(sessionId: string, sessionData: ZodAdminSession): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.adminSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionData.id,
        adminId: sessionData.adminId,
        createdAt: BigInt(sessionData.createdAt),
        expiresAt: BigInt(sessionData.expiresAt),
      },
      update: {
        adminId: sessionData.adminId,
        createdAt: BigInt(sessionData.createdAt),
        expiresAt: BigInt(sessionData.expiresAt),
      },
    });
  },

  async delete(sessionId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.adminSession
      .delete({
        where: { id: sessionId },
      })
      .catch(() => {
        // セッションが存在しない場合は無視
      });
  },

  async deleteByAdminId(adminId: string): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.adminSession.deleteMany({
      where: { adminId },
    });

    return result.count;
  },

  async deleteExpired(): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lt: BigInt(Date.now()),
        },
      },
    });

    return result.count;
  },
};

export const InviteDB = {
  async get(token: string): Promise<ZodInvite | null> {
    const prisma = getPrismaClient();
    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite) return null;

    return {
      token: invite.token,
      createdAt: Number(invite.createdAt),
      expiresAt: Number(invite.expiresAt),
      used: invite.used,
      usedAt: invite.usedAt ? Number(invite.usedAt) : undefined,
    };
  },

  async set(inviteData: ZodInvite): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.invite.upsert({
      where: { token: inviteData.token },
      create: {
        token: inviteData.token,
        createdAt: BigInt(inviteData.createdAt),
        expiresAt: BigInt(inviteData.expiresAt),
        used: inviteData.used,
        usedAt: inviteData.usedAt ? BigInt(inviteData.usedAt) : null,
      },
      update: {
        createdAt: BigInt(inviteData.createdAt),
        expiresAt: BigInt(inviteData.expiresAt),
        used: inviteData.used,
        usedAt: inviteData.usedAt ? BigInt(inviteData.usedAt) : null,
      },
    });
  },

  async markAsUsed(token: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.invite.update({
      where: { token },
      data: {
        used: true,
        usedAt: BigInt(Date.now()),
      },
    });
  },

  async delete(token: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.invite.delete({
      where: { token },
    });
  },

  async deleteExpired(): Promise<number> {
    const prisma = getPrismaClient();

    const result = await prisma.invite.deleteMany({
      where: {
        expiresAt: {
          lt: BigInt(Date.now()),
        },
      },
    });

    return result.count;
  },

  async list(): Promise<ZodInvite[]> {
    const prisma = getPrismaClient();
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
    });

    return invites.map((invite) => ({
      token: invite.token,
      createdAt: Number(invite.createdAt),
      expiresAt: Number(invite.expiresAt),
      used: invite.used,
      usedAt: invite.usedAt ? Number(invite.usedAt) : undefined,
    }));
  },
};
