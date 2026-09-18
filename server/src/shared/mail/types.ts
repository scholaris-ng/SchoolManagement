/** A rendered message, ready for any provider to deliver. */
export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

/**
 * A mail transport. `mailer.ts` never imports nodemailer or the Apps Script
 * client directly — only this shape, so the provider behind `send()` can be
 * swapped in `router.ts` without touching any of the `send*Email` functions
 * or their call sites.
 */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
