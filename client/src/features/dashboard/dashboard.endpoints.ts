import { http } from '@/lib/http';
import type {
  AdminDashboard,
  BursarDashboard,
  ParentDashboard,
  StudentDashboard,
  TeacherDashboard,
} from '@/types/analytics';

/**
 * Endpoint layer for the role dashboards.
 *
 * Payloads are assembled server-side with SQL aggregation. The client asks one
 * question and gets one answer: totals for 3,000 students must never be
 * computed by shipping 3,000 rows to a browser (spec section 43).
 */
export const DashboardEndpoints = {
  fetchAdmin: () => http.get<AdminDashboard>('/dashboard/admin'),
  fetchTeacher: () => http.get<TeacherDashboard>('/dashboard/teacher'),
  fetchParent: () => http.get<ParentDashboard>('/dashboard/parent'),
  fetchStudent: () => http.get<StudentDashboard>('/dashboard/student'),
  fetchBursar: () => http.get<BursarDashboard>('/dashboard/bursar'),
};
