import { http } from '@/lib/http';
import type { PickupPerson } from '@/types/people';
import type { BehaviourTermRating } from '@/types/behaviour';
import type { ReportCard } from '@/types/results';
import type {
  StudentAttendanceRange,
  StudentAttendanceResult,
  StudentLedgerResult,
  StudentPickupResult,
} from './students.types';

/** Endpoints for a child's record across the other modules. */
export const StudentHistoryEndpoints = {
  fetchAttendance: (studentId: string, range: StudentAttendanceRange) =>
    http.get<StudentAttendanceResult>(`/students/${studentId}/attendance`, { query: range }),

  fetchLedger: (studentId: string) =>
    http.get<StudentLedgerResult>(`/students/${studentId}/ledger`),

  fetchBehaviour: (studentId: string, termId?: string) =>
    http.get<BehaviourTermRating[]>(`/students/${studentId}/behaviour`, { query: { termId } }),

  fetchResults: (studentId: string, termId?: string) =>
    http.get<ReportCard>(`/students/${studentId}/results`, { query: { termId } }),

  fetchPickupPersons: (studentId: string) =>
    http.get<StudentPickupResult>(`/students/${studentId}/pickup`),

  createPickupPerson: (studentId: string, values: Partial<PickupPerson>) =>
    http.post<PickupPerson>(`/students/${studentId}/pickup`, values),

  updatePickupPerson: (studentId: string, id: string, values: Partial<PickupPerson>) =>
    http.patch<PickupPerson>(`/students/${studentId}/pickup/${id}`, values),
};
