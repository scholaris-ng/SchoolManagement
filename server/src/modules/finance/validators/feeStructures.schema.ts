import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/** Mirrors what `fee-structure-dialog.tsx` posts. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

const structureBody = z.object({
  name: z.string().trim().min(1, 'Give the structure a name').max(120),
  sessionId: z.string().uuid('Choose the session this applies to'),
  /**
   * Null means "any term in this session" — the same fees every term, which is
   * how most schools bill tuition. A run generated from one of those has to be
   * told which term it is billing.
   */
  termId: z.string().uuid().nullable().optional(),
  /** Empty means every level; empty classes means every class within them. */
  levelIds: z.array(z.string().uuid()).max(50).default([]),
  classIds: z.array(z.string().uuid()).max(200).default([]),
  lines: z
    .array(
      z
        .object({
          feeItemId: z.string().uuid(),
          /** Omitted takes the fee item's own amount. */
          amount: z.coerce.number().min(0, 'An amount cannot be negative').optional(),
          isOptional: z.boolean().optional(),
          /**
           * Which of the fee item's own accounts apply here — an item with
           * two accounts might be billed under just one for this cohort.
           * Omitted or empty means none are shown on the invoice for this
           * charge; the service silently drops any id that is not actually
           * one of this item's accounts.
           */
          accountIds: z.array(z.string().uuid()).max(10).default([]),
        })
        .strict(),
    )
    .min(1, 'A structure needs at least one charge')
    .max(50)
    .refine(
      (lines) => new Set(lines.map((line) => line.feeItemId)).size === lines.length,
      'The same fee item appears twice',
    ),
  isActive: z.boolean().default(true),
});

export const fetchFeeStructuresSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().trim().max(120).optional(),
      sessionId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
      isActive: z.enum(['true', 'false']).optional(),
    })
    .strict(),
});

export const feeStructureParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const createFeeStructureSchema = z.object({ body: structureBody.strict() });

export const updateFeeStructureSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: structureBody.partial().strict(),
});

/**
 * Billing a whole cohort in one action.
 *
 * `termId` is required only where the structure has none of its own; the
 * service is what enforces that, because only it knows which kind this is.
 */
export const generateInvoicesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      dueDate: isoDate,
      termId: z.string().uuid().optional(),
      /** Printed bold on every invoice the run creates — a due-date warning, typically. */
      note: z.string().trim().max(500).optional().or(z.literal('')),
    })
    .strict(),
});

export type FetchFeeStructuresQuery = z.infer<typeof fetchFeeStructuresSchema>['query'];
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>['body'];
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>['body'];
export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>['body'];
