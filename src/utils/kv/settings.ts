import { UserSettingsSchema, type UserSettings } from "../schema";

export const SettingsKV = {
  async get(kv: KVNamespace, userId: string): Promise<UserSettings | null> {
    try {
      const data = await kv.get(`settings:${userId}`);
      return data ? UserSettingsSchema.parse(JSON.parse(data)) : null;
    } catch (error) {
      console.error(`Failed to get settings for ${userId}:`, error);
      return null;
    }
  },

  async set(
    kv: KVNamespace,
    userId: string,
    settings: UserSettings
  ): Promise<void> {
    const validatedSettings = UserSettingsSchema.parse(settings);
    await kv.put(`settings:${userId}`, JSON.stringify(validatedSettings));
  },

  async update(
    kv: KVNamespace,
    userId: string,
    partialSettings: Partial<UserSettings>
  ): Promise<UserSettings | null> {
    const existingSettings = await this.get(kv, userId);
    if (!existingSettings) return null;

    const updatedSettings = {
      ...existingSettings,
      ...partialSettings,
      updatedAt: Date.now(),
    };

    await this.set(kv, userId, updatedSettings);
    return updatedSettings;
  },

  async delete(kv: KVNamespace, userId: string): Promise<void> {
    await kv.delete(`settings:${userId}`);
  },
};
