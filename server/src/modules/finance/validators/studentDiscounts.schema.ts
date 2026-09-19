import { z } from 'zod';

const uuid = z.string().uuid();

export const studentDiscountsParamSchema = z.object({
  params: z.object({ id: uuid }),
});

/**
 * Which bills a grant reaches. `termId` alone is enough — the session is
 * derived from it — and neither means "until revoked". A `sessionId` with no
 * `termId` covers every term of that session.
 */
export const grantStudentDiscountSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      discountId: uuid,
      sessionId: uuid.nullable().optional(),
      termId: uuid.nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
    })
    .strict(),
});

export const revokeStudentDiscountSchema = z.object({
  params: z.object({ id: uuid, grantId: uuid }),
});

export type GrantStudentDiscountInput = z.infer<typeof grantStudentDiscountSchema>['body'];
