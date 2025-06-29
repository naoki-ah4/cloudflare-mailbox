import type { Email } from 'postal-mime';
import type { EmailMessage } from './types';

export function createEmailMessage(
  parsedEmail: Email,
  messageId: string,
  attachments: EmailMessage['attachments']
): EmailMessage {
  return {
    id: messageId,
    from: parsedEmail.from?.address || '',
    to:
      parsedEmail.to
        ?.map((addr) => addr.address)
        .filter((addr) => typeof addr === 'string') || [],
    subject: parsedEmail.subject || '',
    date: parsedEmail.date || new Date().toISOString(),
    text: parsedEmail.text,
    html: parsedEmail.html,
    attachments,
    threadId: generateThreadId(parsedEmail),
    inReplyTo: parsedEmail.headers.find(
      (header) => String(header.name).toLowerCase() === 'in-reply-to'
    )?.value,
    references: parseReferences(
      parsedEmail.headers.find(
        (header) => String(header.name).toLowerCase() === 'references'
      )?.value
    ),
  };
}

export function generateThreadId(parsedEmail: Email): string {
  const inReplyTo = parsedEmail.headers.find(
    (header) => String(header.name).toLowerCase() === 'in-reply-to'
  )?.value;
  const references = parsedEmail.headers?.find(
    (header) => String(header.name).toLowerCase() === 'references'
  )?.value;

  if (inReplyTo) {
    return inReplyTo.replace(/[<>]/g, '');
  }

  if (references) {
    const refs = references.split(/\s+/).filter((ref) => ref.length > 0);
    if (refs.length > 0) {
      return refs[0].replace(/[<>]/g, '');
    }
  }

  const messageId = parsedEmail.headers.find(
    (header) => String(header.name).toLowerCase() === 'message-id'
  )?.value;
  return messageId ? messageId.replace(/[<>]/g, '') : crypto.randomUUID();
}

export function parseReferences(references?: string): string[] | undefined {
  if (!references) return undefined;
  return references
    .split(/\s+/)
    .filter((ref) => ref.length > 0)
    .map((ref) => ref.replace(/[<>]/g, ''));
}
