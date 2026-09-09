import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { DisciplineEndpoints } from './discipline.endpoints';
import type { ReportIncidentInput, TransitionIncidentInput } from './discipline.endpoints';

export type { ReportIncidentInput, TransitionIncidentInput };

export function useIncidents(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.discipline.list(schoolId, query),
    queryFn: () => DisciplineEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useIncident(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.discipline.detail(schoolId, id ?? ''),
    queryFn: () => DisciplineEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useReportIncident() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReportIncidentInput) => DisciplineEndpoints.report(input),
    onSuccess: (incident) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.list(schoolId) });
      toast.success('Incident recorded', { description: incident.referenceNo });
    },
  });
}

/** Moves an incident along: reported -> referred -> reviewed -> action -> resolved. */
export function useTransitionIncident(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionIncidentInput) => DisciplineEndpoints.transition(id, input),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.discipline.detail(schoolId, id), incident);
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.list(schoolId) });
      toast.success('Incident updated');
    },
  });
}
