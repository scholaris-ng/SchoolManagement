import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { StaffMember } from '@/types/people';
import type { StaffPerformanceRow } from '@/types/analytics';
import type { StaffFormValues } from './schema';

/** Endpoint layer for the staff module. */
export const StaffEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<StaffMember>>('/staff', { query }),

  fetchById: (id: string) => http.get<StaffMember>(`/staff/${id}`),

  create: (values: StaffFormValues) => http.post<StaffMember>('/staff', values),

  update: (id: string, values: Partial<StaffFormValues>, version: number) =>
    http.patch<StaffMember>(`/staff/${id}`, values, { version }),

  /** Compliance and coverage per teacher — how management spots who needs help. */
  fetchPerformance: (termId?: string) =>
    http.get<StaffPerformanceRow[]>('/analytics/staff', { query: { termId } }),
};
