import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { DisciplineIncident, IncidentStatus } from '@/types/behaviour';

export interface ReportIncidentInput {
  studentId: string;
  category: string;
  severity: DisciplineIncident['severity'];
  description: string;
  occurredAt: string;
  location?: string;
  evidence?: { name: string; storagePath: string; downloadUrl: string; mimeType: string }[];
}

export interface TransitionIncidentInput {
  status: IncidentStatus;
  note?: string;
  action?: {
    type: string;
    description: string;
    startDate?: string;
    endDate?: string;
  };
  resolution?: string;
  notifyGuardian?: boolean;
}

/**
 * Endpoint layer for discipline incidents.
 *
 * A transition is appended to an immutable timeline with the actor's name,
 * because a discipline record that can be quietly rewritten is worth nothing
 * to the child, the parent or the school (spec section 24).
 */
export const DisciplineEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<DisciplineIncident>>('/discipline', { query }),

  fetchById: (id: string) => http.get<DisciplineIncident>(`/discipline/${id}`),

  report: (input: ReportIncidentInput) => http.post<DisciplineIncident>('/discipline', input),

  transition: (id: string, input: TransitionIncidentInput) =>
    http.post<DisciplineIncident>(`/discipline/${id}/transition`, input),
};
