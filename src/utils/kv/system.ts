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
      allowedEmailAddresses: [],
      updatedAt: now,
    });
  },

  async updateSettings(
    kv: KVNamespace,
    data: {
      allowedDomains?: string[];
      allowedEmailAddresses?: string[];
    },
    adminId: string,
    changes?: string
  ): Promise<SystemSettings> {
    const existingSettings =
      (await this.getSettings(kv)) || (await this.getDefaultSettings());
    const now = Date.now();

    // 新しい設定を作成（既存設定をベースに更新）
    const updatedSettings: SystemSettings = {
      allowedDomains: data.allowedDomains ?? existingSettings.allowedDomains,
      allowedEmailAddresses:
        data.allowedEmailAddresses ?? existingSettings.allowedEmailAddresses,
      updatedAt: now,
    };

    // 履歴に保存（初回設定時も含む）
    const historyEntry: SystemSettingsHistoryEntry = {
      allowedDomains: updatedSettings.allowedDomains,
      allowedEmailAddresses: updatedSettings.allowedEmailAddresses,
      updatedAt: now,
      updatedBy: adminId,
      changes:
        changes ||
        this.generateChangeSummary(existingSettings, updatedSettings),
    };
    await this.addHistoryEntry(kv, historyEntry);

    await this.setSettings(kv, updatedSettings);
    return updatedSettings;
  },

  // 変更内容のサマリーを生成
  generateChangeSummary(
    oldSettings: SystemSettings,
    newSettings: SystemSettings
  ): string {
    const changes = [];

    if (
      JSON.stringify(oldSettings.allowedDomains) !==
      JSON.stringify(newSettings.allowedDomains)
    ) {
      changes.push(`ドメイン設定: ${newSettings.allowedDomains.length}個`);
    }

    if (
      JSON.stringify(oldSettings.allowedEmailAddresses) !==
      JSON.stringify(newSettings.allowedEmailAddresses)
    ) {
      changes.push(
        `受信可能アドレス: ${newSettings.allowedEmailAddresses.length}個`
      );
    }

    return changes.length > 0 ? changes.join(", ") : "設定を更新";
  },
};
