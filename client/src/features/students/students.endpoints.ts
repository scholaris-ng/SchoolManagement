import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Student,
  StudentDocument,
  StudentEnrollment,
  StudentGuardianLink,
  StudentSummary,
  PickupPerson,
  CollectionEvent,
} from '@/types/people';
import type { AttendanceRecord, AttendanceSummary } from '@/types/attendance';
import type { StudentLedgerEntry, StudentFinanceSummary } from '@/types/finance';
import type { BehaviourTermRating } from '@/types/behaviour';
import type { ReportCard } from '@/types/results';
import type { StudentFormValues, PromotionValues, StatusChangeValues } from './schema';

/** Type alias so it keeps the implicit index signature the transport needs. */
export type StudentAttendanceRange = { from?: string; to?: string; termId?: string };

export interface LinkGuardianInput {
  guardianId: string;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isFinanciallyResponsible: boolean;
  canPickUp: boolean;
}

export interface AddStudentDocumentInput {
  name: string;
  category: StudentDocument['category'];
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PromotionResult {
  promoted: number;
  repeated: number;
  graduated: number;
}

export interface StudentAttendanceResult {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export interface StudentLedgerResult {
  summary: StudentFinanceSummary;
  entries: StudentLedgerEntry[];
}

export interface StudentPickupResult {
  persons: PickupPerson[];
  recentEvents: CollectionEvent[];
}

/**
 * Endpoint layer for the student module.
 *
 * Writes that take a `version` send it as `If-Match`, so a concurrent edit is
 * rejected by the server rather than silently overwriting a colleague's change.
 */
export const StudentEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<Student>>('/students', { query }),

  fetchById: (id: string) => http.get<Student>(`/students/${id}`),

  /** Typeahead used by the command palette and every student picker. */
  search: (term: string) =>
    http.get<Paginated<StudentSummary>>('/students/search', {
      query: { search: term, pageSize: 8 },
    }),

  create: (values: StudentFormValues) => http.post<Student>('/students', values),

  update: (id: string, values: Partial<StudentFormValues>, version: number) =>
    http.patch<Student>(`/students/${id}`, values, { version }),

  changeStatus: (id: string, values: StatusChangeValues) =>
    http.post<Student>(`/students/${id}/status`, values),

  /** Bulk promotion at the end of a session; runs in one server transaction. */
  promote: (values: PromotionValues) =>
    http.post<PromotionResult>('/students/promotions', values),

  fetchEnrollments: (studentId: string) =>
    http.get<StudentEnrollment[]>(`/students/${studentId}/enrollments`),

  fetchGuardians: (studentId: string) =>
    http.get<StudentGuardianLink[]>(`/students/${studentId}/guardians`),

  linkGuardian: (studentId: string, values: LinkGuardianInput) =>
    http.post<StudentGuardianLink>(`/students/${studentId}/guardians`, values),

  unlinkGuardian: (studentId: string, linkId: string) =>
    http.delete<void>(`/students/${studentId}/guardians/${linkId}`),

  fetchDocuments: (studentId: string) =>
    http.get<StudentDocument[]>(`/students/${studentId}/documents`),

  addDocument: (studentId: string, values: AddStudentDocumentInput) =>
    http.post<StudentDocument>(`/students/${studentId}/documents`, values),

  removeDocument: (studentId: string, documentId: string) =>
    http.delete<void>(`/students/${studentId}/documents/${documentId}`),

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
