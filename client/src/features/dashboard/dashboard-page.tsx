import { useAuth } from '@/app/providers/auth-provider';
import { AdminDashboard } from './admin-dashboard';
import { TeacherDashboard } from './teacher-dashboard';
import { ParentDashboard } from './parent-dashboard';
import { StudentDashboard } from './student-dashboard';
import { BursarDashboard } from './bursar-dashboard';

/**
 * `/` renders one of five dashboards.
 *
 * A bursar signing in should land on money, a form teacher on this morning's
 * register, a parent on their children — not on a generic landing page with a
 * dozen tiles they have no permission to open (spec section 53).
 */
export function DashboardPage() {
  const { persona } = useAuth();

  switch (persona) {
    case 'admin':
      return <AdminDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'bursar':
      return <BursarDashboard />;
    case 'student':
      return <StudentDashboard />;
    case 'parent':
    default:
      return <ParentDashboard />;
  }
}
