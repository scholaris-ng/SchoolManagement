import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  AdmissionApplication,
  AdmissionFunnel,
  ApplicationStatus,
} from '@/types/admissions';
import type { Student } from '@/types/people';
import type { AdmissionFormValues, ConversionValues } from './schema';

export function useAdmissions(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.list(schoolId, query),
    queryFn: () => http.get<Paginated<AdmissionApplication>>('/admissions', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAdmission(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.detail(schoolId, id ?? ''),
    queryFn: () => http.get<AdmissionApplication>(`/admissions/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export function useAdmissionFunnel(sessionId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.funnel(schoolId, sessionId),
    queryFn: () => http.get<AdmissionFunnel>('/admissions/funnel', { query: { sessionId } }),
    enabled: Boolean(schoolId),
  });
}

export function useCreateAdmission() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: AdmissionFormValues) =>
      http.post<AdmissionApplication>('/admissions', values),
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.funnel(schoolId) });
      toast.success('Application created', { description: application.applicationNo });
    },
  });
}

export interface TransitionInput {
  status: ApplicationStatus;
  note?: string;
  screeningScore?: number;
  offeredClassId?: string;
}

/**
 * Moves an application along its workflow.
 *
 * The status is sent as an intent, not written directly: the server decides
 * whether this actor may make that particular transition (offering a place
 * needs `admission.decide`, not merely `admission.manage`) and records it.
 */
export function useTransitionAdmission(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionInput) =>
      http.post<AdmissionApplication>(`/admissions/${id}/transition`, input),
    onSuccess: (application) => {
      queryClient.setQueryData(queryKeys.admissions.detail(schoolId, id), application);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.funnel(schoolId) });
      toast.success('Application updated');
    },
  });
}

/**
 * Turns an accepted applicant into an enrolled student in one transaction —
 * personal details, guardians and uploaded documents all carry across, so
 * nothing the family typed is keyed in a second time (spec section 10).
 */
export function useConvertAdmission(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ConversionValues) =>
      http.post<{ student: Student; applicationId: string }>(
        `/admissions/${id}/convert`,
        values,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(schoolId, id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.funnel(schoolId) });
      toast.success('Applicant enrolled', {
        description: `${result.student.fullName} · ${result.student.admissionNo}`,
      });
    },
  });
}
