import { buildShareMessage, toWhatsAppNumber } from '../utils/whatsapp';
import { StorageService } from './storage.service';

/** What the browser needs to open WhatsApp: the message, and who it goes to if known. */
export interface WhatsAppShare {
  fileUrl: string;
  message: string;
  /** International digits for `wa.me`, or `null` when the person should pick the chat. */
  phone: string | null;
  /**
   * Why there is no `phone` when there ought to have been one — a guardian with
   * no usable number — for the sender to be told. `null` when there is a number,
   * and also for a document that never has a recipient, where there is nothing to fix.
   */
  notice: string | null;
}

export interface ShareDocumentParams {
  /** Groups the file under its own folder, e.g. `invoice`. */
  kind: 'invoice' | 'receipt' | 'bill' | 'fee-schedule';
  pdf: Buffer;
  /** Human-readable part of the stored file's name, e.g. an invoice number. */
  name: string;
  greeting: string;
  subject: string;
  /** As typed on the guardian's record — normalised here. */
  phone?: string | null;
  notice?: string | null;
  confidential: boolean;
  schoolName: string;
  contactEmail?: string;
}

/**
 * Turns a rendered PDF into something a person can send from WhatsApp: it is
 * stored, and the message that goes with it is written around its link.
 *
 * Nothing here talks to WhatsApp. The browser opens WhatsApp Web with this
 * message already typed, and the person pressing Send is what sends it — there
 * is no WhatsApp Business account, token or template behind this.
 */
export class WhatsAppShareService {
  static Instance = new WhatsAppShareService();

  private constructor(private readonly storage = StorageService.Instance) {}

  async shareDocument(params: ShareDocumentParams): Promise<WhatsAppShare> {
    const file = await this.storage.uploadPdf(params.pdf, {
      folder: `scholaris/finance/${params.kind}`,
      name: params.name,
    });

    return {
      fileUrl: file.url,
      phone: toWhatsAppNumber(params.phone),
      notice: params.notice ?? null,
      message: buildShareMessage({
        greeting: params.greeting,
        subject: params.subject,
        fileUrl: file.url,
        confidential: params.confidential,
        schoolName: params.schoolName,
        contactEmail: params.contactEmail,
      }),
    };
  }
}
