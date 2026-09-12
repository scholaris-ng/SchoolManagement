import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'POS', 'ONLINE', 'CHEQUE'] as const;
const PAYMENT_PROVIDERS = ['RAVEN', 'MANUAL'] as const;

export const fetchPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    studentId: z.string().uuid().optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    provider: z.enum(PAYMENT_PROVIDERS).optional(),
  }),
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
export type CreatePaymentAccountInput = z.infer<typeof createPaymentAccountSchema>['body'];
export type RavenWebhookBody = z.infer<typeof ravenWebhookSchema>['body'];
