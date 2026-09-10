/**
 * Payloads for the management analytics screen, mirroring
 * `client/src/types/analytics.ts`, `types/attendance.ts`, `types/finance.ts`
 * and `types/admissions.ts` exactly.
 *
 * Most of what this screen wants has no source yet — the assessment, register,
 * ledger and admissions tables do not exist server-side. Following the same
 * rule as `dashboard.dto.ts`: the fields are answered as zero or empty rather
 * than dropped, so the client renders its own empty state instead of an error,
 * and each gap is commented with the module that will fill it.
 */

/* -- Academic ------------------------------------------------------------- */

export interface SubjectPerformanceDTO {
  subjectId: string;
  subjectName: string;
  averageScore: number;
  passRate: number;
  studentsAssessed: number;
  highest: number;
  lowest: number;
}

export interface GradeDistributionDTO {
  grade: string;
  count: number;
  color?: string | null;
}

export interface ClassComparisonDTO {
  className: string;
  average: number;
  passRate: number;
}

export interface ResultAnalyticsDTO {
  termName: string;
  overallAverage: number;
  passRate: number;
  subjects: SubjectPerformanceDTO[];
  gradeDistribution: GradeDistributionDTO[];
  classComparison: ClassComparisonDTO[];
}

/* -- Attendance ----------------------------------------------------------- */

export interface ClassAttendanceSummaryDTO {
  classId: string;
  className: string;
  attendanceRate: number;
  totalDays: number;
}

export interface AttendanceTrendPointDTO {
  date: string;
  label: string;
  rate: number;
  present: number;
  absent: number;
}

/* -- Finance -------------------------------------------------------------- */

export interface FinanceOverviewDTO {
  currency: string;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalDiscount: number;
  collectionRate: number;
  debtorCount: number;
  unreconciledCount: number;
  unreconciledAmount: number;
  collectionTrend: { label: string; billed: number; collected: number }[];
  byCategory: { category: string; billed: number; collected: number }[];
}

/* -- Admissions ----------------------------------------------------------- */

export interface AdmissionFunnelDTO {
  sessionName: string;
  received: number;
  screened: number;
  shortlisted: number;
  offered: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
  conversionRate: number;
  trend: { label: string; applications: number; accepted: number }[];
  byLevel: { levelName: string; applications: number; offered: number; accepted: number }[];
}

/* -- Staff ---------------------------------------------------------------- */

export interface StaffPerformanceDTO {
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

/* -- Retention ------------------------------------------------------------ */

export interface RetentionSignalDTO {
  key: string;
  label: string;
  detail: string;
  weight: number;
}

export interface RetentionRiskDTO {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: RetentionSignalDTO[];
  outstandingBalance: number;
  attendanceRate: number;
  guardianLastLoginAt?: string | null;
  lastContactedAt?: string | null;
}
