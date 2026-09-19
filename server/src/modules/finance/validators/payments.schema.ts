import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'POS', 'ONLINE', 'CHEQUE'] as const;
const PAYMENT_PROVIDERS = ['RAVEN', 'MANUAL'] as const;

const PAYMENT_STATUSES = ['PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED'] as const;

/**
 * The methods a *human* may record. `ONLINE` is absent on purpose: an online
 * credit is only ever written by the webhook, after Raven's own API has been
 * asked to confirm it, so letting the office key one in by hand would create
 * a payment with nothing behind it (spec section 27).
 */
export const MANUAL_METHODS = ['CASH', 'BANK_TRANSFER', 'POS', 'CHEQUE'] as const;

export const fetchPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    studentId: z.string().uuid().optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    provider: z.enum(PAYMENT_PROVIDERS).optional(),
    status: z.enum(PAYMENT_STATUSES).optional(),
    // A query string has no booleans; the reconciliation filter sends the word.
    reconciled: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['paidAt', 'amount']).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  }),
});

/**
 * Cash at the desk, a transfer the office saw on the statement, a POS stub, a
 * cheque.
 *
 * `allocations` says which bills the money settles. It defaults to empty, and
 * empty is a real answer: money paid on account, which the office assigns to
 * an invoice later. The service is what checks the invoices belong to the same
 * student, are still open, and are not being over-paid.
 */
export const recordPaymentSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose the student this payment is for'),
      amount: z.coerce
        .number()
        .positive('Enter the amount received')
        .max(100_000_000, 'That amount is larger than a school fee could be'),
      method: z.enum(MANUAL_METHODS),
      paidAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
      /** The teller number or cheque number off the slip. */
      reference: z.string().trim().max(80).optional().or(z.literal('')),
      note: z.string().trim().max(2000).optional().or(z.literal('')),
      allocations: z
        .array(
          z
            .object({
              invoiceId: z.string().uuid(),
              amount: z.coerce.number().positive('An allocation must be more than nothing'),
            })
            .strict(),
        )
        .max(50)
        .default([])
        .refine(
          (rows) => new Set(rows.map((row) => row.invoiceId)).size === rows.length,
          'The same invoice appears twice — add the amounts together instead',
        ),
    })
    .strict(),
});

export const reconcilePaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({ note: z.string().trim().max(2000).optional().or(z.literal('')) })
    .strict(),
});

/**
 * A reason is required, not optional: a reversal takes money back off a
 * family's account, and whoever reads the audit log later needs to know
 * whether it was a mistyped amount or something that deserves a closer look.
 */
export const reversePaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .min(3, 'Say why this payment is being reversed')
        .max(500, 'Keep the reason under 500 characters'),
    })
    .strict(),
});

export const receiptParamSchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
});

export const sendReceiptEmailSchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
  body: z
    .object({
      guardianId: z.string().uuid('Choose the guardian this receipt is for'),
      includeCharges: z.boolean().default(false),
    })
    .strict(),
});

/**
 * Sharing a receipt on WhatsApp. No guardian is named: the server addresses it
 * to whoever pays the student's fees, and the sender can change the chat in
 * WhatsApp itself.
 */
export const shareReceiptWhatsAppSchema = z.object({
  params: z.object({ paymentId: z.string().uuid() }),
  body: z.object({ includeCharges: z.boolean().default(false) }).strict(),
});

/**
 * Asking Raven for an account number a family can pay a specific bill into.
 * The amount is the whole of what is being asked for: Raven ties the account
 * to it, so the office decides the figure here, not the parent at the bank.
 */
export const createPaymentAccountSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose the student this is for'),
      amount: z.coerce
        .number()
        .positive('Enter the amount the family should pay')
        .max(100_000_000, 'That amount is larger than a school fee could be'),
      /**
       * The payer's Bank Verification Number. CBN rules require one for any
       * account issued in a person's name, and Raven's partner refuses
       * without it. Passed straight through to Raven and never written to
       * our database — see `PaymentsService.createCollectionAccount`.
       */
      bvn: z
        .string()
        .trim()
        .regex(/^\d{11}$/, 'A BVN is exactly 11 digits'),
      note: z.string().trim().max(200).optional().or(z.literal('')),
      /**
       * Tie the account to one bill, so whatever lands on it allocates itself
       * against that invoice instead of sitting on account.
       */
      invoiceId: z.string().uuid().optional(),
    })
    .strict(),
});

export const studentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

/**
 * What Raven posts to the webhook. Deliberately loose: only the two things
 * this side genuinely needs are required, and everything else is kept as-is
 * for the audit trail. Raven's own record of the credit is fetched back by
 * `session_id` before anything is written, so the shape of the notification
 * itself is never what a payment is trusted on.
 */
export const ravenWebhookSchema = z.object({
  body: z
    .object({
      secret: z.string().min(1),
      type: z.string().optional(),
      session_id: z.string().optional(),
      data: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});

export type FetchPaymentsQuery = z.infer<typeof fetchPaymentsSchema>['query'];
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>['body'];
export type ReconcilePaymentInput = z.infer<typeof reconcilePaymentSchema>['body'];
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>['body'];
export type SendReceiptEmailInput = z.infer<typeof sendReceiptEmailSchema>['body'];
export type ShareReceiptWhatsAppInput = z.infer<typeof shareReceiptWhatsAppSchema>['body'];
export type CreatePaymentAccountInput = z.infer<typeof createPaymentAccountSchema>['body'];
export type RavenWebhookBody = z.infer<typeof ravenWebhookSchema>['body'];
