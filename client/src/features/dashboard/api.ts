import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import type {
  AdminDashboard,
  BursarDashboard,
  ParentDashboard,
  StudentDashboard,
  TeacherDashboard,
} from '@/types/analytics';

/**
 * Dashboard payloads are assembled server-side with SQL aggregation.
 *
 * The client asks one question and gets one answer: totals for 3,000 students
 * must never be computed by shipping 3,000 rows to a browser (spec section 43).
 */
const DASHBOARD_STALE_TIME = 2 * 60_000;

export function useAdminDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.admin(schoolId),
    queryFn: () => http.get<AdminDashboard>('/dashboard/admin'),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useTeacherDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.teacher(schoolId),
    queryFn: () => http.get<TeacherDashboard>('/dashboard/teacher'),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useParentDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.parent(schoolId),
    queryFn: () => http.get<ParentDashboard>('/dashboard/parent'),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useStudentDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.student(schoolId),
    queryFn: () => http.get<StudentDashboard>('/dashboard/student'),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useBursarDashboard(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.bursar(schoolId),
    queryFn: () => http.get<BursarDashboard>('/dashboard/bursar'),
    enabled: Boolean(schoolId) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
  });
}
