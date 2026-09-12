export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * Who filled the form in.
 *
 * `GUARDIAN` is a parent applying for a child; `SELF` is an applicant old
 * enough to apply for themselves, which is most of a senior school's intake.
 * The two ask for different things, and the office needs to know which it is
 * reading before it picks up the phone.
 */
export type ApplicantType = 'GUARDIAN' | 'SELF';

export type ApplicationSource = 'OFFICE' | 'WEBSITE' | 'IMPORT';

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
  city?: string | null;
  state?: string | null;
  previousSchool?: string | null;
  previousClass?: string | null;
  bloodGroup?: string | null;
  medicalNotes?: string | null;
  /** Set only where the applicant applied on their own behalf. */
  email?: string | null;
  phone?: string | null;
}

/**
 * Somebody the school may contact about an application.
 *
 * Named a contact and not a guardian on purpose. Until the child is enrolled
 * these people exist only on the application — they have no guardian record,
 * no portal login, no place in the parent directory and no fee liability.
 * Enrolling the applicant is what promotes them, and nothing before it does.
 */
export interface ApplicationContact {
  title?: string | null;
  firstName: string;
  lastName: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';
  email: string;
  phone: string;
  occupation?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
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
  desiredClassId: string | null;
  desiredClassName: string | null;
  applicantType: ApplicantType;
  source: ApplicationSource;
  applicant: AdmissionApplicant;
  contacts: ApplicationContact[];
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

/* -- The public application form ------------------------------------------- */

/** What a school publishes as the choices on its own application form. */
export interface PublicAdmissionOptions {
  open: boolean;
  sessions: { id: string; name: string; isCurrent: boolean }[];
  classes: { id: string; name: string; levelName: string }[];
}

/** What a family is told once their application has been received. */
export interface PublicApplicationReceipt {
  submittedAt: string;
  applications: { applicationNo: string; applicantName: string; className: string }[];
  contactEmail: string;
}

/** What the "respond to this offer" link shows — reachable by token alone, no account. */
export interface PublicOffer {
  applicationNo: string;
  applicantName: string;
  schoolName: string;
  className: string | null;
  sessionName: string;
  offerExpiresOn: string | null;
  status: ApplicationStatus;
  respondable: boolean;
}
