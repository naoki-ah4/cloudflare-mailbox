import {
  SystemSettingsSchema,
  SystemSettingsHistorySchema,
  type SystemSettings,
  type SystemSettingsHistory,
  type SystemSettingsHistoryEntry,
} from "./schema";

export const SystemKV = {
  async getSettings(kv: KVNamespace): Promise<SystemSettings | null> {
    try {
      const data = await kv.get("system:settings");
      return data ? SystemSettingsSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error("Failed to get system settings:", error);
      return null;
    }
  },

  async setSettings(kv: KVNamespace, settings: SystemSettings): Promise<void> {
    const validatedSettings = SystemSettingsSchema.parse(settings);
    await kv.put("system:settings", JSON.stringify(validatedSettings));
  },

  async getHistory(kv: KVNamespace): Promise<SystemSettingsHistory> {
    try {
      const data = await kv.get("system:settings:history");
      return data ? SystemSettingsHistorySchema.parse(JSON.parse(data)) : [];
    } catch (error) {
      console.error("Failed to get system settings history:", error);
      return [];
    }
  },

  async addHistoryEntry(
    kv: KVNamespace,
    entry: SystemSettingsHistoryEntry
  ): Promise<void> {
    const history = await this.getHistory(kv);
    history.push(entry);
    await kv.put("system:settings:history", JSON.stringify(history));
  },

  async getDefaultSettings(): Promise<SystemSettings> {
    const now = Date.now();
    return SystemSettingsSchema.parse({
      allowedDomains: [],
      updatedAt: now,
    });
  },

  async updateSettings(
    kv: KVNamespace,
    allowedDomains: string[],
    adminId: string,
    changes?: string
  ): Promise<SystemSettings> {
    const existingSettings = await this.getSettings(kv);
    const now = Date.now();

    // 新しい設定を作成
    const updatedSettings: SystemSettings = {
      allowedDomains,
      updatedAt: now,
    };

    // 履歴に保存（初回設定時も含む）
    const historyEntry: SystemSettingsHistoryEntry = {
      allowedDomains,
      updatedAt: now,
      updatedBy: adminId,
      changes:
        changes ||
        (existingSettings
          ? `ドメイン設定を更新: ${allowedDomains.length}個`
          : `初回ドメイン設定: ${allowedDomains.length}個`),
    };
    await this.addHistoryEntry(kv, historyEntry);

    await this.setSettings(kv, updatedSettings);
    return updatedSettings;
  },
};
