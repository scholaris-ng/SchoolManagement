import { z } from 'zod';

/** The channels a receipt reaches a family by. `OTHER` covers post, a courier, or a staff member's own phone. */
export const RECEIPT_DELIVERY_CHANNELS = ['PRINT', 'EMAIL', 'WHATSAPP', 'OTHER'] as const;

export const receiptDeliveryParamSchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
});

export const deliveryIdParamSchema = z.object({
  params: z.object({ deliveryId: z.string().uuid() }),
});

/**
 * Recording a copy that has already gone out.
 *
 * Every field about *who* it went to is optional: a receipt printed and handed
 * across the counter has no recipient to name beyond the person standing there,
 * and refusing to log it without one would simply mean it never got logged.
 */
export const recordReceiptDeliverySchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
  body: z
    .object({
      channel: z.enum(RECEIPT_DELIVERY_CHANNELS, {
        errorMap: () => ({ message: 'Choose how the receipt was sent' }),
      }),
      /** Fills in the name and address or number from the guardian's own record. */
      guardianId: z.string().uuid().optional(),
      /** Only needed when it went to somebody who is not a guardian on file. */
      recipientName: z.string().trim().max(160).optional(),
      recipientContact: z.string().trim().max(160).optional(),
      includeCharges: z.boolean().default(false),
      note: z.string().trim().max(500).optional(),
      /** When it actually went out, for a copy being logged after the fact. Defaults to now. */
      sentAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
});

/**
 * What the browser logs for itself once it has started a print or opened
 * WhatsApp. No status: neither of those proves the family has anything, so the
 * server decides, and the only thing the client may say is which of the two it
 * was and what shape of receipt went.
 */
export const logReceiptDeliverySchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
  body: z
    .object({
      channel: z.enum(['PRINT'], {
        errorMap: () => ({ message: 'Only a print is logged this way' }),
      }),
      includeCharges: z.boolean().default(false),
      /** Which shape of paper came out — the POS slip or the full page. */
      note: z.string().trim().max(120).optional(),
    })
    .strict(),
});

export type RecordReceiptDeliveryInput = z.infer<typeof recordReceiptDeliverySchema>['body'];
export type LogReceiptDeliveryInput = z.infer<typeof logReceiptDeliverySchema>['body'];
