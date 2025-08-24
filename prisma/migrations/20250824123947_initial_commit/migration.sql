-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` TEXT NOT NULL,
    `createdAt` BIGINT NOT NULL,
    `lastLogin` BIGINT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_username_idx`(`username`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_managed_emails` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` BIGINT NOT NULL,

    INDEX `user_managed_emails_email_idx`(`email`),
    INDEX `user_managed_emails_userId_idx`(`userId`),
    UNIQUE INDEX `user_managed_emails_userId_email_key`(`userId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `createdAt` BIGINT NOT NULL,
    `expiresAt` BIGINT NOT NULL,

    INDEX `sessions_userId_idx`(`userId`),
    INDEX `sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_managed_emails` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,

    INDEX `session_managed_emails_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `session_managed_emails_sessionId_email_key`(`sessionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invites` (
    `token` VARCHAR(191) NOT NULL,
    `createdAt` BIGINT NOT NULL,
    `expiresAt` BIGINT NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `usedAt` BIGINT NULL,

    INDEX `invites_expiresAt_idx`(`expiresAt`),
    INDEX `invites_used_idx`(`used`),
    PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `passwordHash` TEXT NOT NULL,
    `createdAt` BIGINT NOT NULL,
    `lastLogin` BIGINT NULL,

    UNIQUE INDEX `admins_username_key`(`username`),
    INDEX `admins_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `createdAt` BIGINT NOT NULL,
    `expiresAt` BIGINT NOT NULL,

    INDEX `admin_sessions_adminId_idx`(`adminId`),
    INDEX `admin_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_messages` (
    `id` VARCHAR(191) NOT NULL,
    `from` VARCHAR(255) NOT NULL,
    `subject` TEXT NOT NULL,
    `date` VARCHAR(255) NOT NULL,
    `text` LONGTEXT NULL,
    `html` LONGTEXT NULL,
    `threadId` VARCHAR(255) NULL,
    `inReplyTo` VARCHAR(255) NULL,
    `originalFrom` VARCHAR(255) NULL,
    `isCatchAll` BOOLEAN NOT NULL DEFAULT false,

    INDEX `email_messages_from_idx`(`from`),
    INDEX `email_messages_threadId_idx`(`threadId`),
    INDEX `email_messages_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `type` VARCHAR(10) NOT NULL,

    INDEX `email_recipients_messageId_idx`(`messageId`),
    INDEX `email_recipients_email_idx`(`email`),
    INDEX `email_recipients_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(100) NOT NULL,
    `r2Key` VARCHAR(500) NOT NULL,
    `size` INTEGER NOT NULL,

    INDEX `email_attachments_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_references` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(255) NOT NULL,

    INDEX `email_references_messageId_idx`(`messageId`),
    INDEX `email_references_reference_idx`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_metadata` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `from` VARCHAR(255) NOT NULL,
    `subject` TEXT NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `hasAttachments` BOOLEAN NOT NULL,
    `size` INTEGER NOT NULL,
    `threadId` VARCHAR(255) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` BIGINT NULL,
    `originalFrom` VARCHAR(255) NULL,
    `folderId` VARCHAR(191) NULL,

    INDEX `email_metadata_messageId_idx`(`messageId`),
    INDEX `email_metadata_recipient_idx`(`recipient`),
    INDEX `email_metadata_date_idx`(`date`),
    INDEX `email_metadata_isRead_idx`(`isRead`),
    INDEX `email_metadata_folderId_idx`(`folderId`),
    INDEX `email_metadata_threadId_idx`(`threadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folders` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NULL,
    `createdAt` BIGINT NOT NULL,
    `updatedAt` BIGINT NOT NULL,

    INDEX `folders_userId_idx`(`userId`),
    UNIQUE INDEX `folders_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `threads` (
    `id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sent_emails` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `from` VARCHAR(255) NOT NULL,
    `subject` TEXT NOT NULL,
    `text` LONGTEXT NULL,
    `html` LONGTEXT NULL,
    `sentAt` VARCHAR(255) NOT NULL,
    `resendId` VARCHAR(255) NOT NULL,
    `threadId` VARCHAR(255) NULL,
    `inReplyTo` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL,

    INDEX `sent_emails_userId_idx`(`userId`),
    INDEX `sent_emails_from_idx`(`from`),
    INDEX `sent_emails_sentAt_idx`(`sentAt`),
    INDEX `sent_emails_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sent_email_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `sentEmailId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `type` VARCHAR(10) NOT NULL,

    INDEX `sent_email_recipients_sentEmailId_idx`(`sentEmailId`),
    INDEX `sent_email_recipients_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sent_email_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `sentEmailId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(100) NOT NULL,
    `r2Key` VARCHAR(500) NOT NULL,
    `size` INTEGER NOT NULL,

    INDEX `sent_email_attachments_sentEmailId_idx`(`sentEmailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sent_email_references` (
    `id` VARCHAR(191) NOT NULL,
    `sentEmailId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(255) NOT NULL,

    INDEX `sent_email_references_sentEmailId_idx`(`sentEmailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `userId` VARCHAR(191) NOT NULL,
    `emailNotifications` BOOLEAN NOT NULL DEFAULT true,
    `theme` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `language` VARCHAR(5) NOT NULL DEFAULT 'ja',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    `createdAt` BIGINT NOT NULL,
    `updatedAt` BIGINT NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unauthorizedEmailHandling` VARCHAR(20) NOT NULL DEFAULT 'REJECT',
    `catchAllEmailAddress` VARCHAR(255) NULL,
    `updatedAt` BIGINT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_allowed_domains` (
    `id` VARCHAR(191) NOT NULL,
    `systemSettingsId` INTEGER NOT NULL,
    `domain` VARCHAR(255) NOT NULL,

    INDEX `system_allowed_domains_systemSettingsId_idx`(`systemSettingsId`),
    INDEX `system_allowed_domains_domain_idx`(`domain`),
    UNIQUE INDEX `system_allowed_domains_systemSettingsId_domain_key`(`systemSettingsId`, `domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_allowed_emails` (
    `id` VARCHAR(191) NOT NULL,
    `systemSettingsId` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,

    INDEX `system_allowed_emails_systemSettingsId_idx`(`systemSettingsId`),
    INDEX `system_allowed_emails_email_idx`(`email`),
    UNIQUE INDEX `system_allowed_emails_systemSettingsId_email_key`(`systemSettingsId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings_history` (
    `id` VARCHAR(191) NOT NULL,
    `unauthorizedEmailHandling` VARCHAR(20) NOT NULL,
    `catchAllEmailAddress` VARCHAR(255) NULL,
    `updatedAt` BIGINT NOT NULL,
    `updatedBy` VARCHAR(191) NOT NULL,
    `changes` TEXT NOT NULL,

    INDEX `system_settings_history_updatedBy_idx`(`updatedBy`),
    INDEX `system_settings_history_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings_history_domains` (
    `id` VARCHAR(191) NOT NULL,
    `historyId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(255) NOT NULL,

    INDEX `system_settings_history_domains_historyId_idx`(`historyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings_history_emails` (
    `id` VARCHAR(191) NOT NULL,
    `historyId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,

    INDEX `system_settings_history_emails_historyId_idx`(`historyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `key` VARCHAR(255) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `firstAttempt` BIGINT NOT NULL,
    `lastAttempt` BIGINT NOT NULL,

    INDEX `rate_limits_lastAttempt_idx`(`lastAttempt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_managed_emails` ADD CONSTRAINT `user_managed_emails_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_managed_emails` ADD CONSTRAINT `session_managed_emails_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_recipients` ADD CONSTRAINT `email_recipients_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `email_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `email_attachments_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `email_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_references` ADD CONSTRAINT `email_references_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `email_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_metadata` ADD CONSTRAINT `email_metadata_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `email_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_metadata` ADD CONSTRAINT `email_metadata_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sent_emails` ADD CONSTRAINT `sent_emails_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sent_email_recipients` ADD CONSTRAINT `sent_email_recipients_sentEmailId_fkey` FOREIGN KEY (`sentEmailId`) REFERENCES `sent_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sent_email_attachments` ADD CONSTRAINT `sent_email_attachments_sentEmailId_fkey` FOREIGN KEY (`sentEmailId`) REFERENCES `sent_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sent_email_references` ADD CONSTRAINT `sent_email_references_sentEmailId_fkey` FOREIGN KEY (`sentEmailId`) REFERENCES `sent_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_allowed_domains` ADD CONSTRAINT `system_allowed_domains_systemSettingsId_fkey` FOREIGN KEY (`systemSettingsId`) REFERENCES `system_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_allowed_emails` ADD CONSTRAINT `system_allowed_emails_systemSettingsId_fkey` FOREIGN KEY (`systemSettingsId`) REFERENCES `system_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings_history` ADD CONSTRAINT `system_settings_history_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings_history_domains` ADD CONSTRAINT `system_settings_history_domains_historyId_fkey` FOREIGN KEY (`historyId`) REFERENCES `system_settings_history`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings_history_emails` ADD CONSTRAINT `system_settings_history_emails_historyId_fkey` FOREIGN KEY (`historyId`) REFERENCES `system_settings_history`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
