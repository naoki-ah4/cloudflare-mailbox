import { SystemKV } from "./kv/system";

export interface DomainValidationResult {
  isValid: boolean;
  invalidEmails: string[];
  message?: string;
}

export const validateEmailDomains = async (
  emails: string[],
  systemKv: KVNamespace
): Promise<DomainValidationResult> => {
  try {
    const settings = await SystemKV.getSettings(systemKv);

    // 許可ドメインが設定されていない場合は全て許可
    if (!settings || settings.allowedDomains.length === 0) {
      return {
        isValid: true,
        invalidEmails: [],
      };
    }

    const invalidEmails: string[] = [];

    for (const email of emails) {
      const domain = email.split("@")[1];
      if (!settings.allowedDomains.includes(domain)) {
        invalidEmails.push(email);
      }
    }

    if (invalidEmails.length > 0) {
      return {
        isValid: false,
        invalidEmails,
        message: `以下のドメインは許可されていません: ${invalidEmails.map((e) => e.split("@")[1]).join(", ")}`,
      };
    }

    return {
      isValid: true,
      invalidEmails: [],
    };
  } catch (error) {
    console.error("Domain validation error:", error);
    // エラーが発生した場合は安全側に倒して全て許可
    return {
      isValid: true,
      invalidEmails: [],
    };
  }
};
