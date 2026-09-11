import type { AbsenceReason, AttendanceStatus } from '../entities/attendanceRecord.entity';

/**
 * The wire shapes, mirroring `client/src/types/attendance.ts` and
 * `client/src/features/attendance/attendance.endpoints.ts`.
 *
 * Hand-written rather than returning entities: the client contract is fixed and
 * already shipped, so it is the DTO that must not drift, not the table.
 */

export interface AttendanceRecordDTO {
  /**
   * Empty for a pupil nobody has marked yet. There is no row for them — see
   * `AttendanceRecord` — and minting an id here would claim otherwise.
   */
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl: string | null;
  classId: string;
  date: string;
  status: AttendanceStatus;
  reason: AbsenceReason | null;
  note: string | null;
  markedByName: string | null;
  /** Null means this pupil has not been marked, so `status` is the form's default. */
  markedAt: string | null;
  guardianNotifiedAt: string | null;
}

export interface AttendanceRegisterDTO {
  schoolId: string;
  classId: string;
  className: string;
  date: string;
  termId: string;
  /** Viewable but not writable — the date sits outside the current term. */
  isLocked: boolean;
  takenByName: string | null;
  takenAt: string | null;
  records: AttendanceRecordDTO[];
}

export interface SaveRegisterResultDTO {
  saved: number;
  notificationsSent: number;
}

/* -- Aggregates read by the analytics and dashboard modules ---------------- */

export interface ClassAttendanceRateRow {
  classId: string;
  className: string;
  attendanceRate: number;
  totalDays: number;
}

export interface AttendanceTrendRow {
  date: string;
  label: string;
  rate: number;
  present: number;
  absent: number;
}

export interface DailyAttendanceRow {
  attendanceRate: number;
  markedClasses: number;
}

export interface PendingRegisterRow {
  classId: string;
  className: string;
  date: string;
}

export interface StaffAttendanceComplianceRow {
  staffId: string;
  /** Percentage of the days their form classes were open that they marked. */
  compliance: number;
}
