import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { StaffMember } from '@/types/people';
import type { StaffPerformanceRow } from '@/types/analytics';
import type { StaffFormValues } from './schema';

/**
 * Creating a staff member opens their account in the same step, so the
 * server hands back the one-time password it generated alongside the new
 * record. Nothing keeps it after this response — it is never present on a
 * later read of the same staff member.
 */
export interface CreatedStaffMember extends StaffMember {
  temporaryPassword: string;
}

/** Endpoint layer for the staff module. */
export const StaffEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<StaffMember>>('/staff', { query }),

  fetchById: (id: string) => http.get<StaffMember>(`/staff/${id}`),

  create: (values: StaffFormValues) => http.post<CreatedStaffMember>('/staff', values),

  update: (id: string, values: Partial<StaffFormValues>, version: number) =>
    http.patch<StaffMember>(`/staff/${id}`, values, { version }),

  /** Compliance and coverage per teacher — how management spots who needs help. */
  fetchPerformance: (termId?: string) =>
    http.get<StaffPerformanceRow[]>('/analytics/staff', { query: { termId } }),
};
