import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/** Mirrors what `custom-bill-dialog.tsx` posts. */

const customBillLine = z
  .object({
    description: z.string().trim().min(1, 'Give this charge a description').max(200),
    amount: z.coerce.number().min(0, 'An amount cannot be negative'),
  })
  .strict();

const customBillBody = z.object({
  payerName: z.string().trim().min(1, 'Say who this bill is for').max(200),
  lines: z
    .array(customBillLine)
    .min(1, 'A bill needs at least one charge')
    .max(50),
  /** Printed bold, the same as a generated invoice's note. */
  note: z.string().trim().max(500).optional().or(z.literal('')),
  /**
   * Which of the school's centrally-managed accounts (`PaymentDestination`)
   * settle this bill — any one of these settles the whole total, not a
   * split. Omitted on a PATCH leaves the existing accounts alone, as
   * `feeItems.schema.ts` does.
   */
  paymentDestinationIds: z.array(z.string().uuid()).max(10, 'That is a lot of accounts for one bill').optional(),
});

export const fetchCustomBillsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().trim().max(120).optional(),
    })
    .strict(),
});

export const customBillParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const createCustomBillSchema = z.object({ body: customBillBody.strict() });

export const updateCustomBillSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: customBillBody.partial().strict(),
});

export type FetchCustomBillsQuery = z.infer<typeof fetchCustomBillsSchema>['query'];
export type CreateCustomBillInput = z.infer<typeof createCustomBillSchema>['body'];
export type UpdateCustomBillInput = z.infer<typeof updateCustomBillSchema>['body'];
