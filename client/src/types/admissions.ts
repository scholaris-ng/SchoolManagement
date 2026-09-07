export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface AdmissionApplicant {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  photoUrl?: string | null;
  nationality?: string | null;
  stateOfOrigin?: string | null;
  address?: string | null;
  previousSchool?: string | null;
  bloodGroup?: string | null;
  medicalNotes?: string | null;
}

export interface AdmissionGuardianInput {
  title?: string | null;
  firstName: string;
  lastName: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';
  email: string;
  phone: string;
  occupation?: string | null;
  address?: string | null;
  isPrimaryContact: boolean;
}

export interface AdmissionDocument {
  id: string;
  name: string;
  category: string;
  storagePath: string;
  downloadUrl?: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface AdmissionStageEvent {
  id: string;
  status: ApplicationStatus;
  actorName: string;
  occurredAt: string;
  note?: string | null;
}

export interface AdmissionApplication {
  id: string;
  schoolId: string;
  applicationNo: string;
  sessionId: string;
  sessionName: string;
  levelId: string;
  levelName: string;
  applicant: AdmissionApplicant;
  guardians: AdmissionGuardianInput[];
  documents: AdmissionDocument[];
  status: ApplicationStatus;
  screeningScore?: number | null;
  interviewDate?: string | null;
  interviewNote?: string | null;
  decisionNote?: string | null;
  offeredClassId?: string | null;
  offeredClassName?: string | null;
  offerExpiresOn?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  acceptedAt?: string | null;
  /** Set once the applicant has been converted, preventing a second conversion. */
  convertedStudentId?: string | null;
  timeline: AdmissionStageEvent[];
  version: number;
}

export interface AdmissionFunnel {
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
