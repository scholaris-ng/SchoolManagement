import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { FEE_CATEGORIES } from '../entities/feeItem.entity';

const feeItemBody = z.object({
  name: z.string().trim().min(1, 'A fee name is required').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'A fee code is required')
    .max(20)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(2000).nullable().optional(),
  amount: z.coerce.number().min(0, 'An amount cannot be negative'),
  category: z.enum(FEE_CATEGORIES as unknown as [string, ...string[]]),
  isOptional: z.boolean().default(false),
  isRecurring: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const fetchFeeItemsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  }),
});

export const createFeeItemSchema = z.object({ body: feeItemBody.strict() });

export const updateFeeItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: feeItemBody.partial().strict(),
});

export type CreateFeeItemInput = z.infer<typeof createFeeItemSchema>['body'];
export type UpdateFeeItemInput = z.infer<typeof updateFeeItemSchema>['body'];
export type FetchFeeItemsQuery = z.infer<typeof fetchFeeItemsSchema>['query'];
