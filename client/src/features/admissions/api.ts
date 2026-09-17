import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { AdmissionFormValues, ConversionValues } from './schema';
import { AdmissionEndpoints } from './admissions.endpoints';
import type {
  TransitionInput,
  ConversionResult,
  LinkApplicationGuardianInput,
  ScheduleInterviewInput,
  UpdateScreeningScoreInput,
} from './admissions.endpoints';

export type {
  TransitionInput,
  ConversionResult,
  ScheduleInterviewInput,
  LinkApplicationGuardianInput,
  UpdateScreeningScoreInput,
};

export function useAdmissions(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.list(schoolId, query),
    queryFn: () => AdmissionEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAdmission(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.detail(schoolId, id ?? ''),
    queryFn: () => AdmissionEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useAdmissionFunnel(sessionId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.admissions.funnel(schoolId, sessionId),
    queryFn: () => AdmissionEndpoints.fetchFunnel(sessionId),
    enabled: Boolean(schoolId),
  });
}

export function useCreateAdmission() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: AdmissionFormValues) => AdmissionEndpoints.create(values),
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.funnel(schoolId) });
      toast.success('Application created', { description: application.applicationNo });
    },
  });
}

/** Moves an application along its workflow. */
export function useTransitionAdmission(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionInput) => AdmissionEndpoints.transition(id, input),
    onSuccess: (application) => {
      queryClient.setQueryData(queryKeys.admissions.detail(schoolId, id), application);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.funnel(schoolId) });
      toast.success('Application updated');
    },
  });
}

/** Sets up, or records the result of, an interview — never touches `status`. */
export function useScheduleInterview(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScheduleInterviewInput) => AdmissionEndpoints.scheduleInterview(id, input),
    onSuccess: (application) => {
      queryClient.setQueryData(queryKeys.admissions.detail(schoolId, id), application);
      toast.success('Interview details saved');
    },
  });
}

/** Corrects a screening score after the fact — never touches `status`. */
export function useUpdateScreeningScore(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateScreeningScoreInput) => AdmissionEndpoints.updateScreeningScore(id, input),
    onSuccess: (application) => {
      queryClient.setQueryData(queryKeys.admissions.detail(schoolId, id), application);
      toast.success('Screening score saved');
    },
  });
}

/** Attaches an existing guardian record to the application, before enrollment. */
export function useLinkApplicationGuardian(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LinkApplicationGuardianInput) => AdmissionEndpoints.linkGuardian(id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(schoolId, id) });
      toast.success('Guardian linked to application');
    },
  });
}

export function useUnlinkApplicationGuardian(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => AdmissionEndpoints.unlinkGuardian(id, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(schoolId, id) });
      toast.success('Guardian unlinked');
    },
  });
}

/** Turns an accepted applicant into an enrolled student in one transaction. */
export function useConvertAdmission(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ConversionValues) => AdmissionEndpoints.convert(id, values),
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
