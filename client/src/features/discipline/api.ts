import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { DisciplineIncident, IncidentStatus } from '@/types/behaviour';

export function useIncidents(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.discipline.list(schoolId, query),
    queryFn: () => http.get<Paginated<DisciplineIncident>>('/discipline', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useIncident(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.discipline.detail(schoolId, id ?? ''),
    queryFn: () => http.get<DisciplineIncident>(`/discipline/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export interface ReportIncidentInput {
  studentId: string;
  category: string;
  severity: DisciplineIncident['severity'];
  description: string;
  occurredAt: string;
  location?: string;
  evidence?: { name: string; storagePath: string; downloadUrl: string; mimeType: string }[];
}

export function useReportIncident() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReportIncidentInput) =>
      http.post<DisciplineIncident>('/discipline', input),
    onSuccess: (incident) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.list(schoolId) });
      toast.success('Incident recorded', { description: incident.referenceNo });
    },
  });
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
 * Moving an incident along: reported → referred → reviewed → action → resolved.
 *
 * Each step is appended to an immutable timeline with the actor's name, because
 * a discipline record that can be quietly rewritten is worth nothing to the
 * child, the parent or the school (spec section 24).
 */
export function useTransitionIncident(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionIncidentInput) =>
      http.post<DisciplineIncident>(`/discipline/${id}/transition`, input),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.discipline.detail(schoolId, id), incident);
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.list(schoolId) });
      toast.success('Incident updated');
    },
  });
}
