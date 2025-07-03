/**
 * SRS (Sender Rewriting Scheme) メールアドレス解析ユーティリティ
 * 転送メールから元の送信者アドレスを復元する機能を提供
 */

export type SRSInfo = {
  originalSender?: string;
  forwardingSystem: string;
  isForwarded: boolean;
};

/**
 * SRSフォーマットのメールアドレスから元の送信者情報を解析
 *
 * 対応フォーマット:
 * - msprvs1=エンコード情報=システム識別子@ドメイン
 * - bounces-数字@notify.cloudflare.com
 * - その他の一般的なSRSパターン
 *
 * @param srsAddress - 解析対象のメールアドレス
 * @returns SRS情報オブジェクト
 */
export const decodeSRSAddress = (srsAddress: string): SRSInfo => {
  if (!srsAddress || typeof srsAddress !== "string") {
    return {
      forwardingSystem: "unknown",
      isForwarded: false,
    };
  }

  const trimmedAddress = srsAddress.trim().toLowerCase();

  // Cloudflare通知システムのパターン
  if (trimmedAddress.includes("@notify.cloudflare.com")) {
    return {
      forwardingSystem: "Cloudflare Email Routing",
      isForwarded: true,
    };
  }

  // msprvs1形式のSRSパターン
  const msprvsMatch = trimmedAddress.match(/^msprvs1=([^=]+)=([^@]+)@(.+)$/);
  if (msprvsMatch) {
    const [, encodedInfo, systemId, domain] = msprvsMatch;

    try {
      // Base64デコードを試行（一般的なSRSエンコーディング）
      const decodedInfo = atob(encodedInfo);
      const originalMatch = decodedInfo.match(/([^@]+@[^@]+)/);

      return {
        originalSender: originalMatch ? originalMatch[1] : undefined,
        forwardingSystem: `${systemId}@${domain}`,
        isForwarded: true,
      };
    } catch {
      // デコード失敗時
      return {
        forwardingSystem: `${systemId}@${domain}`,
        isForwarded: true,
      };
    }
  }

  // bounces-形式のパターン
  const bouncesMatch = trimmedAddress.match(/^bounces-(\d+)@(.+)$/);
  if (bouncesMatch) {
    const [, , domain] = bouncesMatch;
    return {
      forwardingSystem: `bounces@${domain}`,
      isForwarded: true,
    };
  }

  // SRS0形式（標準的なSRS）
  const srs0Match = trimmedAddress.match(
    /^srs0=([^=]+)=([^=]+)=([^=]+)=([^@]+)@(.+)$/
  );
  if (srs0Match) {
    const [, , , localPart, domain] = srs0Match;
    return {
      originalSender: `${localPart}@${domain}`,
      forwardingSystem: "SRS0",
      isForwarded: true,
    };
  }

  // SRS1形式（2段転送）
  const srs1Match = trimmedAddress.match(/^srs1=([^=]+)=([^@]+)@(.+)$/);
  if (srs1Match) {
    const [, , originalSrs, domain] = srs1Match;
    // SRS1の場合、さらにSRS0を解析
    const nestedSrs = decodeSRSAddress(`${originalSrs}@${domain}`);
    return {
      originalSender: nestedSrs.originalSender,
      forwardingSystem: `SRS1 via ${nestedSrs.forwardingSystem}`,
      isForwarded: true,
    };
  }

  // その他の転送システムパターン
  const commonForwardingPatterns = [
    { pattern: /@amazonses\.com$/, name: "Amazon SES" },
    { pattern: /@sendgrid\.net$/, name: "SendGrid" },
    { pattern: /@mailgun\.org$/, name: "Mailgun" },
    { pattern: /@postmarkapp\.com$/, name: "Postmark" },
    { pattern: /noreply|no-reply/i, name: "No-Reply System" },
  ];

  for (const { pattern, name } of commonForwardingPatterns) {
    if (pattern.test(trimmedAddress)) {
      return {
        forwardingSystem: name,
        isForwarded: true,
      };
    }
  }

  // 転送されていない通常のメールアドレス
  return {
    forwardingSystem: "direct",
    isForwarded: false,
  };
};

/**
 * メール表示用に送信者情報をフォーマット
 *
 * @param originalFrom - 元のFromフィールド
 * @param srsInfo - SRS解析結果
 * @returns 表示用の送信者情報
 */
export const formatSenderDisplay = (
  originalFrom: string,
  srsInfo: SRSInfo
): {
  displayFrom: string;
  isForwarded: boolean;
  forwardingInfo?: string;
} => {
  if (!srsInfo.isForwarded) {
    return {
      displayFrom: originalFrom,
      isForwarded: false,
    };
  }

  const displayFrom = srsInfo.originalSender || originalFrom;
  const forwardingInfo = srsInfo.originalSender
    ? `転送元: ${srsInfo.forwardingSystem}`
    : `転送システム: ${srsInfo.forwardingSystem}`;

  return {
    displayFrom,
    isForwarded: true,
    forwardingInfo,
  };
};
