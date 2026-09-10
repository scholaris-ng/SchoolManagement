/**
 * The admin dashboard payload, mirroring `AdminDashboard` in
 * `client/src/types/analytics.ts` exactly.
 *
 * Several fields have no source yet — the finance, attendance, admissions and
 * calendar modules do not exist server-side. They are answered as zero or empty
 * rather than dropped: the client's type requires them, and an honest zero with
 * a comment naming the missing module is easier to reason about than a field
 * that quietly disappears.
 */

export interface StatDeltaDTO {
  value: number;
  direction: 'up' | 'down' | 'flat';
  periodLabel: string;
}

export interface AttendanceTrendPointDTO {
  label: string;
  rate: number;
}

export interface EnrolmentByLevelDTO {
  levelName: string;
  students: number;
}

export interface RecentActivityDTO {
  id: string;
  actorName: string;
  action: string;
  entityLabel: string;
  occurredAt: string;
}

export interface UpcomingEventDTO {
  id: string;
  title: string;
  startDate: string;
  category: string;
}

export interface AdminDashboardDTO {
  currency: string;

  studentCount: number;
  studentDelta: StatDeltaDTO;
  staffCount: number;

  attendanceRateToday: number;
  attendanceMarkedClasses: number;
  totalClasses: number;

  feesBilled: number;
  feesCollected: number;
  feesOutstanding: number;
  collectionRate: number;

  admissionsInProgress: number;
  admissionsAccepted: number;

  attendanceTrend: AttendanceTrendPointDTO[];
  enrolmentByLevel: EnrolmentByLevelDTO[];
  recentActivity: RecentActivityDTO[];
  upcomingEvents: UpcomingEventDTO[];

  atRiskCount: number;
}
