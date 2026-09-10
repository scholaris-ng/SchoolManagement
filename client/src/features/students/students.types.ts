import type {
  CollectionEvent,
  PickupPerson,
  StudentDocument,
} from '@/types/people';
import type { AttendanceRecord, AttendanceSummary } from '@/types/attendance';
import type { StudentLedgerEntry, StudentFinanceSummary } from '@/types/finance';

/** Payload and result shapes shared by the student endpoint files. */

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
