import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { usePermission, useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { StaffMember } from '@/types/people';
import type { StaffPerformanceRow } from '@/types/analytics';
import type { SelectOption } from '@/components/ui/input';
import type { StaffFormValues } from './schema';

export function useStaffList(query: ListQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.staff.list(schoolId, query),
    queryFn: () => http.get<Paginated<StaffMember>>('/staff', { query }),
    enabled: Boolean(schoolId) && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useStaffMember(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.staff.detail(schoolId, id ?? ''),
    queryFn: () => http.get<StaffMember>(`/staff/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export function useCreateStaff() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: StaffFormValues) => http.post<StaffMember>('/staff', values),
    onSuccess: (member) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff.list(schoolId) });
      toast.success('Staff member added', {
        description: `${member.fullName} · ${member.designation}`,
      });
    },
  });
}

export function useUpdateStaff(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<StaffFormValues>; version: number }) =>
      http.patch<StaffMember>(`/staff/${id}`, values, { version }),
    onSuccess: (member) => {
      queryClient.setQueryData(queryKeys.staff.detail(schoolId, id), member);
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff.list(schoolId) });
      // A role change alters what this person may do; their next session must
      // be rebuilt from the server rather than from a cached permission list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Staff record updated');
    },
  });
}

/** Compliance and coverage per teacher — how management spots who needs help. */
export function useStaffPerformance(termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.staff.performance(schoolId, termId),
    queryFn: () => http.get<StaffPerformanceRow[]>('/analytics/staff', { query: { termId } }),
    enabled: Boolean(schoolId),
  });
}

/**
 * Staff as picker options — empty for anyone without `staff.read`.
 *
 * A teacher has no business browsing the roster, so the list is not fetched
 * for them at all: the caller gets nothing to offer instead of a dropdown
 * built from a request that would only have been refused.
 */
export function useTeacherOptions(): SelectOption[] {
  const canReadStaff = usePermission('staff.read');
  const staff = useStaffList(
    { page: 1, pageSize: 200, sortBy: 'lastName', status: 'ACTIVE' },
    { enabled: canReadStaff },
  );
  return (staff.data?.items ?? []).map((member) => ({
    value: member.id,
    label: member.fullName,
    description: member.designation,
  }));
}
