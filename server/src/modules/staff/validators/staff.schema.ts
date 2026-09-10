import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

export const fetchStaffSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    status: z.enum(['ACTIVE', 'ON_LEAVE', 'EXITED']).optional(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).optional(),
    // Free text rather than an enum: departments are whatever a school calls
    // them, and no catalogue of them exists to check against.
    department: z.string().trim().max(120).optional(),
  }),
});

export const staffIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type FetchStaffQuery = z.infer<typeof fetchStaffSchema>['query'];
