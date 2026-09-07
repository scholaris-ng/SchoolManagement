import type { AttendanceTrendPoint } from './attendance';

export interface StatDelta {
  value: number;
  direction: 'up' | 'down' | 'flat';
  periodLabel: string;
}

export interface AdminDashboard {
  currency: string;
  studentCount: number;
  studentDelta: StatDelta;
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
  attendanceTrend: AttendanceTrendPoint[];
  enrolmentByLevel: { levelName: string; students: number }[];
  recentActivity: {
    id: string;
    actorName: string;
    action: string;
    entityLabel: string;
    occurredAt: string;
  }[];
  upcomingEvents: { id: string; title: string; startDate: string; category: string }[];
  atRiskCount: number;
}

export interface TeacherDashboard {
  todayClasses: {
    id: string;
    className: string;
    subjectName: string;
    startTime: string;
    endTime: string;
    roomName?: string | null;
    attendanceTaken: boolean;
  }[];
  pendingAttendance: { classId: string; className: string; date: string }[];
  pendingScoreEntry: {
    scoreSheetId: string;
    className: string;
    subjectName: string;
    enteredCount: number;
    totalCount: number;
    status: string;
  }[];
  lessonNotesDue: { id: string; className: string; subjectName: string; weekNumber: number }[];
  upcomingAssessments: { id: string; title: string; startsAt: string; className: string }[];
  unreadMessages: number;
  curriculumCoverage: { subjectName: string; className: string; coverageRate: number }[];
}

export interface ParentChildSummary {
  studentId: string;
  fullName: string;
  admissionNo: string;
  photoUrl?: string | null;
  className?: string | null;
  attendanceRate: number;
  lastTermAverage?: number | null;
  currentTermAverage?: number | null;
  position?: number | null;
  classSize?: number | null;
  outstandingBalance: number;
  unreadMessages: number;
  housePoints: number;
  resultPublished: boolean;
}

export interface ParentDashboard {
  currency: string;
  children: ParentChildSummary[];
  recentPayments: { id: string; amount: number; paidAt: string; receiptNo?: string | null; studentName: string }[];
  upcomingEvents: { id: string; title: string; startDate: string; category: string }[];
  unreadNotifications: number;
}

export interface StudentDashboard {
  studentId: string;
  fullName: string;
  className?: string | null;
  attendanceRate: number;
  currentTermAverage?: number | null;
  position?: number | null;
  classSize?: number | null;
  housePoints: number;
  houseName?: string | null;
  todayTimetable: {
    id: string;
    subjectName: string;
    startTime: string;
    endTime: string;
    teacherName: string;
    roomName?: string | null;
  }[];
  openAssessments: { id: string; title: string; subjectName: string; endsAt?: string | null }[];
  subjectPerformance: { subjectName: string; score: number; classAverage: number }[];
  announcements: { id: string; title: string; publishAt: string }[];
}

export interface BursarDashboard {
  currency: string;
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  recentPayments: {
    id: string;
    studentName: string;
    amount: number;
    method: string;
    paidAt: string;
    isReconciled: boolean;
  }[];
  unreconciled: { count: number; amount: number };
  topDebtors: {
    studentId: string;
    studentName: string;
    className?: string | null;
    balance: number;
    daysOverdue: number;
  }[];
  collectionTrend: { label: string; billed: number; collected: number }[];
}

export interface SubjectPerformanceRow {
  subjectId: string;
  subjectName: string;
  averageScore: number;
  passRate: number;
  studentsAssessed: number;
  highest: number;
  lowest: number;
}

export interface ResultAnalytics {
  termName: string;
  overallAverage: number;
  passRate: number;
  subjects: SubjectPerformanceRow[];
  gradeDistribution: { grade: string; count: number; color?: string | null }[];
  classComparison: { className: string; average: number; passRate: number }[];
}

/** Early-warning signals for families likely to withdraw (research feature 7). */
export interface RetentionRiskRow {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: { key: string; label: string; detail: string; weight: number }[];
  outstandingBalance: number;
  attendanceRate: number;
  guardianLastLoginAt?: string | null;
  lastContactedAt?: string | null;
}

export interface StaffPerformanceRow {
  staffId: string;
  staffName: string;
  designation: string;
  classCount: number;
  attendanceCompliance: number;
  lessonNoteCompliance: number;
  scoreEntryTimeliness: number;
  curriculumCoverage: number;
  averageStudentScore: number;
  compositeScore: number;
}
