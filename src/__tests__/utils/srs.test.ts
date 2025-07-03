import { describe, it, expect } from "vitest";
import { decodeSRSAddress, formatSenderDisplay } from "../../utils/srs";

describe("SRS Address Decoding", () => {
  describe("decodeSRSAddress", () => {
    it("Cloudflare Email Routing形式を正しく識別", () => {
      const result = decodeSRSAddress("bounces-265094@notify.cloudflare.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("Cloudflare Email Routing");
    });

    it("msprvs1形式のSRSアドレスを解析", () => {
      const result = decodeSRSAddress(
        "msprvs1=20274qdYNumZr=system@example.com"
      );
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("system@example.com");
    });

    it("bounces形式のアドレスを解析", () => {
      const result = decodeSRSAddress("bounces-12345@example.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("bounces@example.com");
    });

    it("SRS0形式の標準的なSRSアドレスを解析", () => {
      const result = decodeSRSAddress(
        "srs0=hash=12345=user=example.com@forwarder.com"
      );
      expect(result.isForwarded).toBe(true);
      expect(result.originalSender).toBe("user@example.com");
      expect(result.forwardingSystem).toBe("SRS0");
    });

    it("SRS1形式の2段転送を解析", () => {
      const result = decodeSRSAddress(
        "srs1=hash=srs0=innerhash=timestamp=user=example.com@forwarder.com"
      );
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toContain("SRS1");
    });

    it("Amazon SESアドレスを識別", () => {
      const result = decodeSRSAddress("bounce@amazonses.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("Amazon SES");
    });

    it("SendGridアドレスを識別", () => {
      const result = decodeSRSAddress("bounce@sendgrid.net");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("SendGrid");
    });

    it("no-replyアドレスを識別", () => {
      const result = decodeSRSAddress("noreply@example.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("No-Reply System");
    });

    it("通常のメールアドレスは転送されていないと判定", () => {
      const result = decodeSRSAddress("user@example.com");
      expect(result.isForwarded).toBe(false);
      expect(result.forwardingSystem).toBe("direct");
    });

    it("空文字列や無効な入力を適切に処理", () => {
      expect(decodeSRSAddress("").isForwarded).toBe(false);
      expect(decodeSRSAddress("").forwardingSystem).toBe("unknown");
    });

    it("大文字小文字を区別しない", () => {
      const result = decodeSRSAddress("BOUNCES-12345@NOTIFY.CLOUDFLARE.COM");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingSystem).toBe("Cloudflare Email Routing");
    });
  });

  describe("formatSenderDisplay", () => {
    it("転送されていないメールは元のアドレスをそのまま表示", () => {
      const srsInfo = { isForwarded: false, forwardingSystem: "direct" };
      const result = formatSenderDisplay("user@example.com", srsInfo);

      expect(result.displayFrom).toBe("user@example.com");
      expect(result.isForwarded).toBe(false);
      expect(result.forwardingInfo).toBeUndefined();
    });

    it("元送信者が特定できた場合は適切にフォーマット", () => {
      const srsInfo = {
        isForwarded: true,
        forwardingSystem: "Cloudflare Email Routing",
        originalSender: "real-sender@example.com",
      };
      const result = formatSenderDisplay(
        "bounces-123@notify.cloudflare.com",
        srsInfo
      );

      expect(result.displayFrom).toBe("real-sender@example.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingInfo).toBe("転送元: Cloudflare Email Routing");
    });

    it("元送信者が不明な場合は転送システム情報のみ表示", () => {
      const srsInfo = {
        isForwarded: true,
        forwardingSystem: "Amazon SES",
      };
      const result = formatSenderDisplay("bounce@amazonses.com", srsInfo);

      expect(result.displayFrom).toBe("bounce@amazonses.com");
      expect(result.isForwarded).toBe(true);
      expect(result.forwardingInfo).toBe("転送システム: Amazon SES");
    });
  });

  describe("実際のケーススタディ", () => {
    it("Cloudflareからの転送メールを正しく処理", () => {
      const testCases = [
        "msprvs1=20274qdYNumZr=bounces-265094@notify.cloudflare.com",
        "bounces-265094@notify.cloudflare.com",
        "return-path-bounces@notify.cloudflare.com",
      ];

      testCases.forEach((address) => {
        const result = decodeSRSAddress(address);
        expect(result.isForwarded).toBe(true);
        expect(result.forwardingSystem).toBe("Cloudflare Email Routing");
      });
    });

    it("一般的な転送サービスのパターンをテスト", () => {
      const testCases = [
        { address: "noreply@github.com", expected: "No-Reply System" },
        { address: "bounce+12345@postmarkapp.com", expected: "Postmark" },
        { address: "auto-reply@mailgun.org", expected: "Mailgun" },
      ];

      testCases.forEach(({ address, expected }) => {
        const result = decodeSRSAddress(address);
        expect(result.isForwarded).toBe(true);
        expect(result.forwardingSystem).toBe(expected);
      });
    });
  });
});
