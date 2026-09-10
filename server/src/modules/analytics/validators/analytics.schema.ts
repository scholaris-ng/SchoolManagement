import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * Every value here arrives on the query string, so each one is coerced from a
 * string before it is checked. An unparseable page number is a 422, never a
 * `NaN` that reaches an OFFSET.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.');

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

export const resultAnalyticsSchema = z.object({
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export const staffPerformanceSchema = z.object({
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export const retentionRiskSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      riskBand: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      classId: z.string().uuid().optional(),
    })
    .strict(),
});

export const attendanceSummarySchema = z.object({
  query: z
    .object({
      classId: z.string().uuid().optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .strict()
    .refine((value) => !value.from || !value.to || value.to >= value.from, {
      message: 'The end of the range cannot come before its start.',
      path: ['to'],
    }),
});

export const attendanceTrendSchema = z.object({
  query: z
    .object({
      classId: z.string().uuid().optional(),
      // A trend needs a window with an end to it. Thirty days is what the
      // dashboard chart plots when it asks for nothing in particular.
      days: z.coerce.number().int().min(1).max(365).default(30),
    })
    .strict(),
});

export const financeOverviewSchema = z.object({
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export const admissionFunnelSchema = z.object({
  query: z.object({ sessionId: z.string().uuid().optional() }).strict(),
});
