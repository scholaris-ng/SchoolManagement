import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

export const fetchAuditSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    action: z.string().trim().max(80).optional(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
    entityType: z.string().trim().max(80).optional(),
    entityId: z.string().trim().max(80).optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export type FetchAuditQuery = z.infer<typeof fetchAuditSchema>['query'];
