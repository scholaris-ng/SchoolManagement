import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { SelectOption } from '@/components/ui/input';
import type { GuardianFormValues } from './schema';
import { GuardianEndpoints } from './guardians.endpoints';

export function useGuardians(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.list(schoolId, query),
    queryFn: () => GuardianEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useGuardian(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.detail(schoolId, id ?? ''),
    queryFn: () => GuardianEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/** All children linked to one guardian — the basis of the parent portal. */
export function useGuardianChildren(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.guardians.children(schoolId, id ?? ''),
    queryFn: () => GuardianEndpoints.fetchChildren(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useCreateGuardian() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: GuardianFormValues) => GuardianEndpoints.create(values),
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
      GuardianEndpoints.update(id, values, version),
    onSuccess: (guardian) => {
      queryClient.setQueryData(queryKeys.guardians.detail(schoolId, id), guardian);
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      toast.success('Guardian updated');
    },
  });
}

/** Sends (or resends) the portal invitation. */
export function useInviteGuardian() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guardianId: string) => GuardianEndpoints.invite(guardianId),
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
