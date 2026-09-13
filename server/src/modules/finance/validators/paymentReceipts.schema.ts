import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { MANUAL_METHODS } from './payments.schema';

const PAYMENT_RECEIPT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** What the upload may be — matches the `document` preset the client validates against. */
export const RECEIPT_FILE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export const RECEIPT_FILE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A family's own claim of having paid — arrives as `multipart/form-data`, so
 * every field lands in `req.body` as a string and `multer` runs ahead of this
 * to put the slip itself on `req.file`.
 */
export const submitPaymentReceiptSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose which child this payment was for'),
      invoiceId: z.string().uuid().optional().or(z.literal('')),
      amount: z.coerce
        .number()
        .positive('Enter the amount you paid')
        .max(100_000_000, 'That amount is larger than a school fee could be'),
      method: z.enum(MANUAL_METHODS),
      paidAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
      /** The teller number or transfer reference off the slip. */
      reference: z.string().trim().max(80).optional().or(z.literal('')),
      note: z.string().trim().max(2000).optional().or(z.literal('')),
    })
    .strict(),
});

export const fetchPaymentReceiptsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    studentId: z.string().uuid().optional(),
    status: z.enum(PAYMENT_RECEIPT_STATUSES).optional(),
  }),
});

export const paymentReceiptIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const approvePaymentReceiptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({ note: z.string().trim().max(2000).optional().or(z.literal('')) })
    .strict(),
});

export const rejectPaymentReceiptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      note: z.string().trim().min(1, 'Say why this is being declined').max(2000),
    })
    .strict(),
});

export type SubmitPaymentReceiptInput = z.infer<typeof submitPaymentReceiptSchema>['body'];
export type FetchPaymentReceiptsQuery = z.infer<typeof fetchPaymentReceiptsSchema>['query'];
export type ApprovePaymentReceiptInput = z.infer<typeof approvePaymentReceiptSchema>['body'];
export type RejectPaymentReceiptInput = z.infer<typeof rejectPaymentReceiptSchema>['body'];
