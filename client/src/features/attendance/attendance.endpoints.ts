import { http } from '@/lib/http';
import type {
  AttendanceMarkInput,
  AttendanceRegister,
  AttendanceTrendPoint,
} from '@/types/attendance';

export interface ClassAttendanceSummaryRow {
  classId: string;
  className: string;
  attendanceRate: number;
  totalDays: number;
}

/** Type aliases so these keep the implicit index signature the transport needs. */
export type AttendanceSummaryQuery = { classId?: string; from?: string; to?: string };
export type AttendanceTrendQuery = { classId?: string; days?: number };

export interface SaveRegisterInput {
  classId: string;
  className: string;
  date: string;
  marks: AttendanceMarkInput[];
}

export interface SaveRegisterResult {
  saved: number;
  notificationsSent: number;
}

/** Endpoint layer for attendance. */
export const AttendanceEndpoints = {
  fetchRegister: (classId: string, date: string) =>
    http.get<AttendanceRegister>('/attendance/register', { query: { classId, date } }),

  fetchSummary: (query: AttendanceSummaryQuery) =>
    http.get<ClassAttendanceSummaryRow[]>('/attendance/summary', { query }),

  fetchTrend: (query: AttendanceTrendQuery) =>
    http.get<AttendanceTrendPoint[]>('/attendance/trend', { query }),

  saveRegister: (input: Omit<SaveRegisterInput, 'className'>) =>
    http.post<SaveRegisterResult>('/attendance/register', {
      classId: input.classId,
      date: input.date,
      marks: input.marks,
    }),
};
