import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import { DashboardEndpoints } from './dashboard.endpoints';

const DASHBOARD_STALE_TIME = 2 * 60_000;

export function useAdminDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.admin(schoolId),
    queryFn: () => DashboardEndpoints.fetchAdmin(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useTeacherDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.teacher(schoolId),
    queryFn: () => DashboardEndpoints.fetchTeacher(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useParentDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.parent(schoolId),
    queryFn: () => DashboardEndpoints.fetchParent(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useStudentDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.student(schoolId),
    queryFn: () => DashboardEndpoints.fetchStudent(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useBursarDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.bursar(schoolId),
    queryFn: () => DashboardEndpoints.fetchBursar(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}
