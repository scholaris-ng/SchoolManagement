import { z } from 'zod';

/** The finance documents a school sends out. A receipt is keyed by its payment. */
export const DELIVERY_DOCUMENT_TYPES = ['RECEIPT', 'INVOICE', 'BILL', 'FEE_SCHEDULE'] as const;

/** The channels a document reaches a family by. `OTHER` covers post, a courier, or a staff member's own phone. */
export const DELIVERY_CHANNELS = ['PRINT', 'EMAIL', 'WHATSAPP', 'OTHER'] as const;

export const DELIVERY_STATUSES = ['PREPARED', 'CONFIRMED', 'FAILED'] as const;

/**
 * Which shape of paper came out: the narrow slip a thermal POS roll takes, or the
 * whole document on A4 or a half sheet.
 */
export const PRINT_FORMATS = ['POS', 'FULL_PAGE'] as const;

const documentParams = z.object({
  documentType: z.enum(DELIVERY_DOCUMENT_TYPES, {
    errorMap: () => ({ message: 'That is not a kind of document this school sends' }),
  }),
  documentId: z.string().uuid(),
});

export const documentDeliveryParamSchema = z.object({ params: documentParams });

export const deliveryIdParamSchema = z.object({
  params: z.object({ deliveryId: z.string().uuid() }),
});

/**
 * The filters a read of the register and a bulk write against it share. Split
 * out so `confirmAllDeliveriesSchema` cannot drift from what `fetchDeliveriesSchema`
 * accepts — the register and "confirm everything on screen" have to agree on
 * what a filter means.
 */
const deliveryScope = {
  documentType: z.enum(DELIVERY_DOCUMENT_TYPES).optional(),
  channel: z.enum(DELIVERY_CHANNELS).optional(),
  /** Narrows prints to one shape of paper — "which receipts only ever got a till slip?". */
  printFormat: z.enum(PRINT_FORMATS).optional(),
  studentId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  search: z.string().trim().max(120).optional(),
};

/**
 * The register itself. Every filter is optional — the unfiltered page is the
 * useful default, since "what went out today" is what the office opens it for.
 */
export const fetchDeliveriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(25),
    ...deliveryScope,
    status: z.enum(DELIVERY_STATUSES).optional(),
    sortBy: z.enum(['sentAt', 'documentLabel', 'studentName']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  }),
});

/**
 * "Mark all as delivered" for whatever the office currently has the register
 * filtered to. No `status` field: this only ever targets a `PREPARED` copy —
 * accepting a status here would let a stray query param confirm what is already
 * `CONFIRMED` or resurrect a `FAILED` send, neither of which "confirm" means.
 */
export const confirmAllDeliveriesSchema = z.object({
  query: z.object(deliveryScope),
});

/**
 * Recording a copy that has already gone out.
 *
 * Every field about *who* it went to is optional: a receipt printed and handed
 * across the counter has no recipient to name beyond the person standing there,
 * and refusing to log it without one would simply mean it never got logged.
 */
export const recordDeliverySchema = z.object({
  params: documentParams,
  body: z
    .object({
      channel: z.enum(DELIVERY_CHANNELS, {
        errorMap: () => ({ message: 'Choose how the document was sent' }),
      }),
      /** Fills in the name and address or number from the guardian's own record. */
      guardianId: z.string().uuid().optional(),
      /** Only needed when it went to somebody who is not a guardian on file. */
      recipientName: z.string().trim().max(160).optional(),
      recipientContact: z.string().trim().max(160).optional(),
      /**
       * Which shape of paper was handed over. Only read on the `PRINT` channel —
       * the service drops it on any other, so an emailed copy cannot be recorded
       * as having had a paper size.
       */
      printFormat: z.enum(PRINT_FORMATS).optional(),
      includeCharges: z.boolean().default(false),
      note: z.string().trim().max(500).optional(),
      /** When it actually went out, for a copy being logged after the fact. Defaults to now. */
      sentAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
});

/**
 * What the browser logs for itself once it has sent a document to a printer.
 *
 * No status and no recipient: a print proves nothing about what a family holds,
 * and it is not addressed to anybody, so the server decides both. An email or a
 * WhatsApp message is logged by the server as it sends, never from here.
 *
 * `printFormat` is required, because the browser is the only thing that knows it
 * — the person chose POS or full page in the print dialog a moment earlier — and
 * a register that recorded "printed" without saying which would leave the office
 * unable to tell a filed document from a till slip.
 */
export const logPrintDeliverySchema = z.object({
  params: documentParams,
  body: z
    .object({
      printFormat: z.enum(PRINT_FORMATS, {
        errorMap: () => ({ message: 'Say whether this was a POS slip or a full page' }),
      }),
      includeCharges: z.boolean().default(false),
      note: z.string().trim().max(120).optional(),
    })
    .strict(),
});

export type FetchDeliveriesQuery = z.infer<typeof fetchDeliveriesSchema>['query'];
export type ConfirmAllDeliveriesQuery = z.infer<typeof confirmAllDeliveriesSchema>['query'];
export type RecordDeliveryInput = z.infer<typeof recordDeliverySchema>['body'];
export type LogPrintDeliveryInput = z.infer<typeof logPrintDeliverySchema>['body'];
export type DeliveryDocumentParams = z.infer<typeof documentDeliveryParamSchema>['params'];
