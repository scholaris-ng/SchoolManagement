import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { School } from '@/types/tenant';
import type { Role, Permission } from '@/types/rbac';
import type { WebsiteContent } from '@/types/engagement';
import type { AuditLogEntry } from '@/types/engagement';
import type { ListQuery, Paginated } from '@/types/api';

export function useSchool() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.detail(schoolId),
    queryFn: () => http.get<School>('/schools/current'),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Saving school settings.
 *
 * The version travels as `If-Match`: two administrators editing the school's
 * branding at the same time must not silently overwrite one another (spec §34).
 */
export function useUpdateSchool() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<School>; version: number }) =>
      http.patch<School>('/schools/current', values, { version }),
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
    queryFn: () => http.get<Role[]>('/roles'),
    enabled: Boolean(schoolId),
  });
}

export function useSaveRole(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: { name?: string; description?: string; permissions: Permission[] }) =>
      id ? http.patch<Role>(`/roles/${id}`, values) : http.post<Role>('/roles', values),
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
    queryFn: () => http.get<WebsiteContent>('/website'),
    enabled: Boolean(schoolId),
  });
}

export function useUpdateWebsite() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<WebsiteContent>) =>
      http.patch<WebsiteContent>('/website', values),
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
    queryFn: () => http.get<Paginated<AuditLogEntry>>('/audit', { query }),
    enabled: Boolean(schoolId),
  });
}
