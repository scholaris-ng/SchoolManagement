import { z } from 'zod';

const paymentDestinationBody = z.object({
  label: z.string().trim().max(80).nullable().optional(),
  bankName: z.string().trim().min(1, 'Give the bank name').max(80),
  accountNumber: z.string().trim().min(1, 'Give the account number').max(20),
  accountName: z.string().trim().min(1, 'Give the account name').max(160),
  sortOrder: z.coerce.number().int().default(0),
});

export const createPaymentDestinationSchema = z.object({
  body: paymentDestinationBody.strict(),
});

export const updatePaymentDestinationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: paymentDestinationBody.partial().strict(),
});

export const paymentDestinationParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

/** Folds a group of duplicate accounts into `keepId`, deleting the rest. */
export const mergePaymentDestinationsSchema = z.object({
  body: z
    .object({
      keepId: z.string().uuid(),
      mergeIds: z.array(z.string().uuid()).min(1, 'Choose at least one duplicate to merge'),
    })
    .strict()
    .refine((body) => !body.mergeIds.includes(body.keepId), {
      message: 'The account being kept cannot also be one of the ones merged away',
      path: ['mergeIds'],
    }),
});

export type CreatePaymentDestinationInput = z.infer<typeof createPaymentDestinationSchema>['body'];
export type UpdatePaymentDestinationInput = z.infer<typeof updatePaymentDestinationSchema>['body'];
export type MergePaymentDestinationsInput = z.infer<typeof mergePaymentDestinationsSchema>['body'];
