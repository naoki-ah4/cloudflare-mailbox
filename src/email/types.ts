export type EmailMessage = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  text?: string;
  html?: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    r2Key: string;
    size: number;
  }>;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  originalFrom?: string;
};

export type EmailMetadata = {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  date: Date;
  hasAttachments: boolean;
  size: number;
  threadId?: string;
  originalFrom?: string;
};
