import type { Gender, StudentStatus } from '../entities/student.entity';

/** Matches `client/src/types/people.ts` field for field. */
export interface StudentDTO {
  id: string;
  schoolId: string;
  admissionNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  photoUrl: string | null;
  photoConsent: boolean;
  admissionDate: string;
  status: StudentStatus;
  currentClassId: string | null;
  currentClassName: string | null;
  currentLevelName: string | null;
  houseId: string | null;
  houseName: string | null;
  bloodGroup: string | null;
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  religion: string | null;
  guardianCount: number;
  customFields: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** The thin shape every picker and the command palette use. */
export interface StudentSummaryDTO {
  id: string;
  admissionNo: string;
  fullName: string;
  photoUrl: string | null;
  photoConsent: boolean;
  className: string | null;
  status: StudentStatus;
}

export interface StudentEnrollmentDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  sessionName: string;
  termId: string | null;
  termName: string | null;
  levelId: string;
  levelName: string;
  classId: string;
  className: string;
  status: string;
  enrolledOn: string;
  exitedOn: string | null;
  note: string | null;
}

export interface StudentDocumentDTO {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  category: string;
  storagePath: string;
  downloadUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
}

export interface PromotionResultDTO {
  promoted: number;
  repeated: number;
  graduated: number;
}
