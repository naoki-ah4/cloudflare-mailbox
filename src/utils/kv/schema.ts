import { z } from "zod";

// ユーザー関連スキーマ
export const UserSchema = z
  .object({
    id: z.string().uuid(),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    managedEmails: z.array(z.string().email()).min(1),
    passwordHash: z.string(),
    createdAt: z.number(),
    lastLogin: z.number().optional(),
  })
  .refine((data) => !data.managedEmails.includes(data.email), {
    message: "Contact email cannot be included in managed emails",
    path: ["email"],
  });

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  managedEmails: z.array(z.string().email()).min(1),
  createdAt: z.number(),
  expiresAt: z.number(),
});

export const InviteSchema = z.object({
  token: z.string().uuid(),
  createdAt: z.number(),
  expiresAt: z.number(),
  used: z.boolean(),
  usedAt: z.number().optional(),
});

// 管理者関連スキーマ
export const AdminSchema = z.object({
  id: z.string().uuid(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  passwordHash: z.string(),
  createdAt: z.number(),
  lastLogin: z.number().optional(),
});

export const AdminSessionSchema = z.object({
  id: z.string().uuid(),
  adminId: z.string().uuid(),
  createdAt: z.number(),
  expiresAt: z.number(),
});

// メッセージ関連スキーマ
export const EmailAttachmentSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  r2Key: z.string(),
  size: z.number().positive(),
});

export const EmailMessageSchema = z.object({
  id: z.string().uuid(),
  from: z.string().email(),
  to: z.array(z.string().email()),
  subject: z.string(),
  date: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(EmailAttachmentSchema),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  originalFrom: z.string().optional(),
});

export const EmailMetadataSchema = z.object({
  messageId: z.string().uuid(),
  from: z.string().email(),
  to: z.array(z.string().email()),
  subject: z.string(),
  date: z.coerce.date(),
  hasAttachments: z.boolean(),
  size: z.number().positive(),
  threadId: z.string().optional(),
  isRead: z.boolean().optional(),
  readAt: z.number().optional(),
  originalFrom: z.string().optional(),
});

export const ThreadMessagesSchema = z.array(z.string().uuid());

// メールボックス関連スキーマ
export const InboxMessagesSchema = z.array(EmailMetadataSchema);

export const FolderMessagesSchema = z.array(EmailMetadataSchema);

export const UserSettingsSchema = z.object({
  userId: z.string().uuid(),
  emailNotifications: z.boolean().default(true),
  theme: z.enum(["light", "dark", "auto"]).default("auto"),
  language: z.enum(["ja", "en"]).default("ja"),
  timezone: z.string().default("Asia/Tokyo"),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// 未許可メール処理方式
export const UnauthorizedEmailHandlingSchema = z.enum(["REJECT", "CATCH_ALL"]);

// システム設定スキーマ
export const SystemSettingsSchema = z.object({
  allowedDomains: z.array(z.string().min(1)).default([]), // ユーザー登録時のドメイン制限
  allowedEmailAddresses: z.array(z.string().email()).default([]), // 受信可能メールアドレス
  unauthorizedEmailHandling: UnauthorizedEmailHandlingSchema.default("REJECT"), // 未許可メール処理方式
  catchAllEmailAddress: z.string().email().optional(), // catch-all転送先アドレス（CATCH_ALL時必須）
  updatedAt: z.number(),
});

// システム設定編集履歴エントリ
export const SystemSettingsHistoryEntrySchema = z.object({
  allowedDomains: z.array(z.string()),
  allowedEmailAddresses: z.array(z.string().email()),
  unauthorizedEmailHandling: UnauthorizedEmailHandlingSchema,
  catchAllEmailAddress: z.string().email().optional(),
  updatedAt: z.number(),
  updatedBy: z.string(), // 管理者ID
  changes: z.string(), // 変更内容の説明
});

// システム設定編集履歴
export const SystemSettingsHistorySchema = z.array(
  SystemSettingsHistoryEntrySchema
);

// KVキー別のスキーママッピング
export const KVSchemas = {
  // USERS_KV
  user: UserSchema,
  session: SessionSchema,
  invite: InviteSchema,
  admin: AdminSchema,
  "admin-session": AdminSessionSchema,

  // MESSAGES_KV
  msg: EmailMessageSchema,
  thread: ThreadMessagesSchema,

  // MAILBOXES_KV
  inbox: InboxMessagesSchema,
  folder: FolderMessagesSchema,
  settings: UserSettingsSchema,

  // SYSTEM_KV
  "system-settings": SystemSettingsSchema,
  "system-settings-history": SystemSettingsHistorySchema,
} as const;

// 型定義をエクスポート
export type User = z.infer<typeof UserSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Invite = z.infer<typeof InviteSchema>;
export type Admin = z.infer<typeof AdminSchema>;
export type AdminSession = z.infer<typeof AdminSessionSchema>;
export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailMetadata = z.infer<typeof EmailMetadataSchema>;
export type EmailAttachment = z.infer<typeof EmailAttachmentSchema>;
export type ThreadMessages = z.infer<typeof ThreadMessagesSchema>;
export type InboxMessages = z.infer<typeof InboxMessagesSchema>;
export type FolderMessages = z.infer<typeof FolderMessagesSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UnauthorizedEmailHandling = z.infer<
  typeof UnauthorizedEmailHandlingSchema
>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
export type SystemSettingsHistoryEntry = z.infer<
  typeof SystemSettingsHistoryEntrySchema
>;
export type SystemSettingsHistory = z.infer<typeof SystemSettingsHistorySchema>;

// レートリミット関連スキーマ
export const RateLimitRecordSchema = z.object({
  attempts: z.number().min(0),
  firstAttempt: z.number(),
  lastAttempt: z.number(),
});

export const RateLimitResultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().min(0),
  resetTime: z.number().optional(),
  message: z.string().optional(),
});

export type RateLimitRecord = z.infer<typeof RateLimitRecordSchema>;
export type RateLimitResult = z.infer<typeof RateLimitResultSchema>;

// KVキーからスキーマ型を推論するヘルパー型
export type KVKeyPrefix = keyof typeof KVSchemas;
export type KVSchemaType<T extends KVKeyPrefix> = z.infer<
  (typeof KVSchemas)[T]
>;
