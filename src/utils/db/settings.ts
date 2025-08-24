import { getPrismaClient } from "./index";
import type {
  UserSettings as ZodUserSettings,
  SystemSettings as ZodSystemSettings,
  SystemSettingsHistoryEntry as ZodSystemSettingsHistoryEntry,
} from "../schema";

export const UserSettingsDB = {
  async get(userId: string): Promise<ZodUserSettings | null> {
    const prisma = getPrismaClient();
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) return null;

    return {
      userId: settings.userId,
      emailNotifications: settings.emailNotifications,
      theme: settings.theme as "light" | "dark" | "auto",
      language: settings.language as "ja" | "en",
      timezone: settings.timezone,
      createdAt: Number(settings.createdAt),
      updatedAt: Number(settings.updatedAt),
    };
  },

  async set(settingsData: ZodUserSettings): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.userSettings.upsert({
      where: { userId: settingsData.userId },
      create: {
        userId: settingsData.userId,
        emailNotifications: settingsData.emailNotifications,
        theme: settingsData.theme,
        language: settingsData.language,
        timezone: settingsData.timezone,
        createdAt: BigInt(settingsData.createdAt),
        updatedAt: BigInt(settingsData.updatedAt),
      },
      update: {
        emailNotifications: settingsData.emailNotifications,
        theme: settingsData.theme,
        language: settingsData.language,
        timezone: settingsData.timezone,
        updatedAt: BigInt(settingsData.updatedAt),
      },
    });
  },

  async delete(userId: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.userSettings.delete({
      where: { userId },
    });
  },

  async updateTheme(
    userId: string,
    theme: "light" | "dark" | "auto"
  ): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.userSettings.update({
      where: { userId },
      data: {
        theme,
        updatedAt: BigInt(Date.now()),
      },
    });
  },

  async updateLanguage(userId: string, language: "ja" | "en"): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.userSettings.update({
      where: { userId },
      data: {
        language,
        updatedAt: BigInt(Date.now()),
      },
    });
  },
};

export const SystemSettingsDB = {
  async get(): Promise<ZodSystemSettings | null> {
    const prisma = getPrismaClient();
    const settings = await prisma.systemSettings.findFirst({
      include: {
        allowedDomains: true,
        allowedEmailAddresses: true,
      },
      orderBy: { id: "desc" },
    });

    if (!settings) return null;

    return {
      allowedDomains: settings.allowedDomains.map((d) => d.domain),
      allowedEmailAddresses: settings.allowedEmailAddresses.map((e) => e.email),
      unauthorizedEmailHandling:
        settings.unauthorizedEmailHandling === "REJECT"
          ? "REJECT"
          : "CATCH_ALL",
      catchAllEmailAddress: settings.catchAllEmailAddress || undefined,
      updatedAt: Number(settings.updatedAt),
    };
  },

  async set(settingsData: ZodSystemSettings): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.systemSettings.create({
      data: {
        allowedDomains: settingsData.allowedDomains,
        allowedEmailAddresses: settingsData.allowedEmailAddresses,
        unauthorizedEmailHandling: settingsData.unauthorizedEmailHandling,
        catchAllEmailAddress: settingsData.catchAllEmailAddress,
        updatedAt: BigInt(settingsData.updatedAt),
      },
    });
  },

  async addToHistory(
    historyEntry: ZodSystemSettingsHistoryEntry
  ): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.systemSettingsHistory.create({
      data: {
        allowedDomains: historyEntry.allowedDomains,
        allowedEmailAddresses: historyEntry.allowedEmailAddresses,
        unauthorizedEmailHandling: historyEntry.unauthorizedEmailHandling,
        catchAllEmailAddress: historyEntry.catchAllEmailAddress,
        updatedAt: BigInt(historyEntry.updatedAt),
        updatedBy: historyEntry.updatedBy,
        changes: historyEntry.changes,
      },
    });
  },

  async getHistory(limit = 50): Promise<ZodSystemSettingsHistoryEntry[]> {
    const prisma = getPrismaClient();
    const history = await prisma.systemSettingsHistory.findMany({
      include: {
        admin: {
          select: { username: true },
        },
        historyAllowedDomains: true,
        historyAllowedEmails: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return history.map((entry) => ({
      allowedDomains: entry.historyAllowedDomains.map((d) => d.domain),
      allowedEmailAddresses: entry.historyAllowedEmails.map((e) => e.email),
      unauthorizedEmailHandling:
        entry.unauthorizedEmailHandling === "REJECT" ? "REJECT" : "CATCH_ALL",
      catchAllEmailAddress: entry.catchAllEmailAddress || undefined,
      updatedAt: Number(entry.updatedAt),
      updatedBy: entry.updatedBy,
      changes: entry.changes,
    }));
  },

  async deleteOldHistory(keepDays = 365): Promise<number> {
    const prisma = getPrismaClient();
    const cutoffDate = BigInt(Date.now() - keepDays * 24 * 60 * 60 * 1000);

    const result = await prisma.systemSettingsHistory.deleteMany({
      where: {
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  },
};
