export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

/** Why a student was away — this is what makes alerts and analytics useful. */
export type AbsenceReason =
  | 'SICK'
  | 'PERMITTED'
  | 'FAMILY'
  | 'TRANSPORT'
  | 'UNEXPLAINED'
  | 'OTHER';

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl?: string | null;
  classId: string;
  date: string;
  status: AttendanceStatus;
  reason?: AbsenceReason | null;
  note?: string | null;
  markedByName?: string | null;
  markedAt?: string | null;
  /** Set once the same-day absence alert has fired — prevents duplicates. */
  guardianNotifiedAt?: string | null;
}

export interface AttendanceRegister {
  schoolId: string;
  classId: string;
  className: string;
  date: string;
  termId: string;
  isLocked: boolean;
  takenByName?: string | null;
  takenAt?: string | null;
  records: AttendanceRecord[];
}

export interface AttendanceMarkInput {
  studentId: string;
  status: AttendanceStatus;
  reason?: AbsenceReason | null;
  note?: string | null;
}

export interface AttendanceSummary {
  studentId?: string;
  classId?: string;
  from: string;
  to: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  unexplainedAbsences: number;
}

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  rate: number;
  present: number;
  absent: number;
}
