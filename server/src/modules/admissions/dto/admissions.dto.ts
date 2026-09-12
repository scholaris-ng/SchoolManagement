import type {
  ApplicantType,
  ApplicationContact,
  ApplicationSource,
  ApplicationStatus,
} from '../entities/admissionApplication.entity';

/**
 * The wire shape of an application, matching the client's
 * `AdmissionApplication` in `client/src/types/admissions.ts`.
 *
 * The nested `applicant` object is flattened across columns in the table — a
 * child is not an entity of its own until they are enrolled — and reassembled
 * here, because that is the shape the form posts and the detail screen reads.
 */

export interface AdmissionApplicantDTO {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  photoUrl: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  previousSchool: string | null;
  previousClass: string | null;
  bloodGroup: string | null;
  medicalNotes: string | null;
  /** Present only for an applicant who applied on their own behalf. */
  email: string | null;
  phone: string | null;
}

export interface AdmissionStageEventDTO {
  id: string;
  status: ApplicationStatus;
  actorName: string;
  occurredAt: string;
  note: string | null;
}

export interface AdmissionApplicationDTO {
  id: string;
  schoolId: string;
  applicationNo: string;
  sessionId: string;
  sessionName: string;
  levelId: string;
  levelName: string;
  applicantType: ApplicantType;
  source: ApplicationSource;
  applicant: AdmissionApplicantDTO;
  /**
   * Named for what they are: people to contact, not guardians of record. They
   * become `Guardian` rows at conversion and not a moment earlier — see
   * `ApplicationContact`.
   */
  contacts: ApplicationContact[];
  /**
   * Always empty for now. No table backs admission documents yet, and the
   * field is present rather than omitted so the client's parser never meets a
   * missing key.
   */
  documents: never[];
  status: ApplicationStatus;
  screeningScore: number | null;
  interviewDate: string | null;
  interviewNote: string | null;
  decisionNote: string | null;
  offeredClassId: string | null;
  offeredClassName: string | null;
  offerExpiresOn: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  acceptedAt: string | null;
  convertedStudentId: string | null;
  timeline: AdmissionStageEventDTO[];
  version: number;
}

/** What the public website is told after a family submits. */
export interface PublicApplicationReceiptDTO {
  submittedAt: string;
  applications: {
    applicationNo: string;
    applicantName: string;
    levelName: string;
  }[];
  /** Repeated from the school's record so the page can say where to write. */
  contactEmail: string;
}
