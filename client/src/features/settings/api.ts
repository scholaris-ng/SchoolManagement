import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { School } from '@/types/tenant';
import type { WebsiteContent } from '@/types/engagement';
import type { ListQuery } from '@/types/api';
import { SettingsEndpoints } from './settings.endpoints';
import type { SaveRoleInput } from './settings.endpoints';

export type { SaveRoleInput };

export function useSchool() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.detail(schoolId),
    queryFn: () => SettingsEndpoints.fetchSchool(),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

/** Saves school settings under optimistic locking. */
export function useUpdateSchool() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<School>; version: number }) =>
      SettingsEndpoints.updateSchool(values, version),
    onSuccess: (school) => {
      queryClient.setQueryData(queryKeys.school.detail(schoolId), school);
      // Branding lives on the membership too, so the shell re-skins immediately.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('School settings saved');
    },
  });
}

export function useRoles() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.roles.list(schoolId),
    queryFn: () => SettingsEndpoints.fetchRoles(),
    enabled: Boolean(schoolId),
  });
}

export function useSaveRole(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: SaveRoleInput) =>
      id ? SettingsEndpoints.updateRole(id, values) : SettingsEndpoints.createRole(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(schoolId) });
      // Anyone holding this role has a different permission set from now on.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Role saved');
    },
  });
}

export function useWebsite() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.website(schoolId),
    queryFn: () => SettingsEndpoints.fetchWebsite(),
    enabled: Boolean(schoolId),
  });
}

export function useUpdateWebsite() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<WebsiteContent>) => SettingsEndpoints.updateWebsite(values),
    onSuccess: (website) => {
      queryClient.setQueryData(queryKeys.school.website(schoolId), website);
      toast.success('Website updated');
    },
  });
}

export function useAuditLog(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.audit.list(schoolId, query),
    queryFn: () => SettingsEndpoints.fetchAuditLog(query),
    enabled: Boolean(schoolId),
  });
}
