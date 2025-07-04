import { useEffect, useRef } from "react";
import { useNotificationPermission } from "./useNotificationPermission";
import { useToastContext } from "../context/ToastContext";
import type { EmailMetadata } from "~/utils/schema";

interface UseNewEmailNotificationOptions {
  emails: (EmailMetadata & { mailbox: string })[];
  enabled?: boolean;
}

export const useNewEmailNotification = ({
  emails,
  enabled = true,
}: UseNewEmailNotificationOptions) => {
  const { showNotification, canShowNotifications, requestPermission } = useNotificationPermission();
  const { showInfo } = useToastContext();
  const lastCheckRef = useRef<number>(Date.now());
  const processedEmailsRef = useRef<Set<string>>(new Set());

  // 新着メールをチェック
  useEffect(() => {
    if (!enabled || !emails.length) return;

    const now = Date.now();
    const newEmails = emails.filter(email => {
      const emailTime = new Date(email.date).getTime();
      const isNew = emailTime > lastCheckRef.current && !processedEmailsRef.current.has(email.messageId);
      
      if (isNew) {
        processedEmailsRef.current.add(email.messageId);
      }
      
      return isNew;
    });

    if (newEmails.length > 0) {
      // ブラウザ通知を表示
      if (canShowNotifications) {
        if (newEmails.length === 1) {
          const email = newEmails[0];
          showNotification(`新着メール: ${email.subject}`, {
            body: `送信者: ${email.from}\nメールボックス: ${email.mailbox}`,
            tag: `email-${email.messageId}`,
          });
        } else {
          showNotification(`${newEmails.length}件の新着メール`, {
            body: `複数のメールボックスに新着メールが届きました`,
            tag: "multiple-emails",
          });
        }
      } else {
        // 通知許可がない場合はトーストで表示
        if (newEmails.length === 1) {
          const email = newEmails[0];
          showInfo(
            "新着メール",
            `${email.subject} (${email.mailbox})`,
            7000
          );
        } else {
          showInfo(
            "新着メール",
            `${newEmails.length}件の新着メールが届きました`,
            7000
          );
        }
      }
    }

    lastCheckRef.current = now;
  }, [emails, enabled, canShowNotifications, showNotification, showInfo]);

  // 初期化時に処理済みメールをセット
  useEffect(() => {
    if (emails.length > 0) {
      const emailIds = new Set(emails.map(email => email.messageId));
      processedEmailsRef.current = emailIds;
    }
  }, []); // 初回のみ

  // 通知許可を要求する関数
  const enableNotifications = async () => {
    const permission = await requestPermission();
    if (permission === "granted") {
      showInfo("通知が有効になりました", "新着メールをデスクトップ通知でお知らせします");
    } else {
      showInfo("通知が無効です", "ブラウザの設定から通知を許可してください");
    }
    return permission;
  };

  return {
    canShowNotifications,
    enableNotifications,
  };
};