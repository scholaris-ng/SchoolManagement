import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * The filters the admissions list sends today. They are checked even though the
 * list is empty: the day applications exist, a filter that was silently ignored
 * for months is a harder bug to see than one that was refused from the start.
 */
export const fetchAdmissionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    status: z
      .enum([
        'DRAFT',
        'SUBMITTED',
        'SCREENING',
        'SHORTLISTED',
        'OFFERED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN',
      ])
      .optional(),
    levelId: z.string().uuid().optional(),
  }),
});

export type FetchAdmissionsQuery = z.infer<typeof fetchAdmissionsSchema>['query'];
