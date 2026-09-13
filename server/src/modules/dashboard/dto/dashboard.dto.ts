/**
 * The admin dashboard payload, mirroring `AdminDashboard` in
 * `client/src/types/analytics.ts` exactly.
 *
 * The finance figures are real now that the ledger exists. What is left with
 * no source is the calendar, which has no events table. Those fields are
 * answered as zero or empty rather than dropped: the client's type requires
 * them, and an honest zero with a comment naming the missing module is easier
 * to reason about than a field that quietly disappears.
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

export interface TeacherTodayClassDTO {
  id: string;
  className: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  roomName?: string | null;
  attendanceTaken: boolean;
}

export interface TeacherPendingAttendanceDTO {
  classId: string;
  className: string;
  date: string;
}

export interface TeacherPendingScoreEntryDTO {
  scoreSheetId: string;
  className: string;
  subjectName: string;
  enteredCount: number;
  totalCount: number;
  status: string;
}

export interface TeacherLessonNoteDueDTO {
  id: string;
  className: string;
  subjectName: string;
  weekNumber: number;
}

export interface TeacherUpcomingAssessmentDTO {
  id: string;
  title: string;
  startsAt: string;
  className: string;
}

export interface TeacherCurriculumCoverageDTO {
  subjectName: string;
  className: string;
  coverageRate: number;
}

/**
 * A teacher's personal to-do list, mirroring `TeacherDashboard` in
 * `client/src/types/analytics.ts` exactly.
 *
 * Every field here is sourced from a module that has no table yet — timetable
 * entries, attendance registers, score sheets, lesson notes, assessments and
 * messaging (see `DashboardService.fetchTeacher`). They are answered empty or
 * zero rather than dropped, the same choice `AdminDashboardDTO` makes above:
 * the client's type requires them, and the screen already renders a clean
 * empty state for each one.
 */
export interface TeacherDashboardDTO {
  todayClasses: TeacherTodayClassDTO[];
  pendingAttendance: TeacherPendingAttendanceDTO[];
  pendingScoreEntry: TeacherPendingScoreEntryDTO[];
  lessonNotesDue: TeacherLessonNoteDueDTO[];
  upcomingAssessments: TeacherUpcomingAssessmentDTO[];
  unreadMessages: number;
  curriculumCoverage: TeacherCurriculumCoverageDTO[];
}

export interface BursarRecentPaymentDTO {
  id: string;
  studentName: string;
  amount: number;
  method: string;
  paidAt: string;
  isReconciled: boolean;
}

export interface BursarTopDebtorDTO {
  studentId: string;
  studentName: string;
  className?: string | null;
  balance: number;
  daysOverdue: number;
}

export interface BursarCollectionTrendPointDTO {
  label: string;
  billed: number;
  collected: number;
}

/**
 * The bursar's landing screen, mirroring `BursarDashboard` in
 * `client/src/types/analytics.ts` exactly.
 *
 * The whole payload is ledger-shaped — invoices, payments, arrears — and every
 * figure on it is now read from those tables. Whole-ledger rather than
 * current-term: see `DashboardService.fetchBursar` for why.
 */
export interface BursarDashboardDTO {
  currency: string;
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  recentPayments: BursarRecentPaymentDTO[];
  unreconciled: { count: number; amount: number };
  topDebtors: BursarTopDebtorDTO[];
  collectionTrend: BursarCollectionTrendPointDTO[];
}

export interface ParentChildSummaryDTO {
  studentId: string;
  fullName: string;
  admissionNo: string;
  photoUrl: string | null;
  className: string | null;
  attendanceRate: number;
  lastTermAverage: number | null;
  currentTermAverage: number | null;
  position: number | null;
  classSize: number | null;
  outstandingBalance: number;
  unreadMessages: number;
  housePoints: number;
  resultPublished: boolean;
}

export interface ParentRecentPaymentDTO {
  id: string;
  amount: number;
  paidAt: string;
  receiptNo: string | null;
  studentName: string;
}

/**
 * A guardian's landing screen, mirroring `ParentDashboard` in
 * `client/src/types/analytics.ts` exactly.
 *
 * Each child's identity, attendance and outstanding balance are real, read
 * from the students, attendance and finance modules respectively. Results
 * (`lastTermAverage`, `currentTermAverage`, `position`, `classSize`,
 * `resultPublished`), messaging (`unreadMessages`) and the calendar
 * (`upcomingEvents`) have no table yet and are answered null, zero or empty —
 * the same honest-absence choice `AdminDashboardDTO` makes.
 */
export interface ParentDashboardDTO {
  currency: string;
  children: ParentChildSummaryDTO[];
  recentPayments: ParentRecentPaymentDTO[];
  upcomingEvents: UpcomingEventDTO[];
  unreadNotifications: number;
}
