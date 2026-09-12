import { z } from 'zod';
import { DISCOUNT_MODES, DISCOUNT_TYPES } from '../entities/discount.entity';

const discountShape = z.object({
  name: z.string().trim().min(1, 'A discount name is required').max(120),
  type: z.enum(DISCOUNT_TYPES as unknown as [string, ...string[]]),
  mode: z.enum(DISCOUNT_MODES as unknown as [string, ...string[]]),
  value: z.coerce.number().min(0, 'A value cannot be negative'),
  appliesToFeeItemIds: z.array(z.string().uuid()).default([]),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

function refinePercentage<T extends { mode: string; value: number }>(body: T): boolean {
  return body.mode !== 'PERCENTAGE' || body.value <= 100;
}

export const createDiscountSchema = z.object({
  body: discountShape.strict().refine(refinePercentage, {
    message: 'A percentage discount cannot exceed 100',
    path: ['value'],
  }),
});

export const updateDiscountSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  // Not re-checked against 100 here: a partial update may carry only one half
  // of the mode/value pair, so the service re-validates once the patch is
  // merged onto the existing row.
  body: discountShape.partial().strict(),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>['body'];
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>['body'];
