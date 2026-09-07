import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { Guardian, StudentGuardianLink } from '@/types/people';
import type { SelectOption } from '@/components/ui/input';
import type { GuardianFormValues } from './schema';

export function useGuardians(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.list(schoolId, query),
    queryFn: () => http.get<Paginated<Guardian>>('/guardians', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useGuardian(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.detail(schoolId, id ?? ''),
    queryFn: () => http.get<Guardian>(`/guardians/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

/** All children linked to one guardian — the basis of the parent portal. */
export function useGuardianChildren(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.children(schoolId, id ?? ''),
    queryFn: () => http.get<StudentGuardianLink[]>(`/guardians/${id}/children`),
    enabled: Boolean(schoolId && id),
  });
}

export function useCreateGuardian() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: GuardianFormValues) => http.post<Guardian>('/guardians', values),
    onSuccess: (guardian) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      toast.success('Guardian added', { description: guardian.fullName });
    },
  });
}

export function useUpdateGuardian(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<GuardianFormValues>; version: number }) =>
      http.patch<Guardian>(`/guardians/${id}`, values, { version }),
    onSuccess: (guardian) => {
      queryClient.setQueryData(queryKeys.guardians.detail(schoolId, id), guardian);
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      toast.success('Guardian updated');
    },
  });
}

/**
 * Sends (or resends) the portal invitation. A guardian account is created in
 * Firebase Auth by the server; the client never handles their credentials.
 */
export function useInviteGuardian() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guardianId: string) =>
      http.post<{ invited: boolean; email: string }>(`/guardians/${guardianId}/invite`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      toast.success('Invitation sent', { description: result.email });
    },
  });
}

export function useGuardianOptions(): SelectOption[] {
  const guardians = useGuardians({ page: 1, pageSize: 200, sortBy: 'lastName' });
  return (guardians.data?.items ?? []).map((guardian) => ({
    value: guardian.id,
    label: guardian.fullName,
    description: `${guardian.phone} · ${guardian.studentCount} ${guardian.studentCount === 1 ? 'child' : 'children'}`,
  }));
}
