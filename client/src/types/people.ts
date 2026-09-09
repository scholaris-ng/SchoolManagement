export type Gender = 'MALE' | 'FEMALE';

export type StudentStatus =
  | 'ACTIVE'
  | 'GRADUATED'
  | 'TRANSFERRED'
  | 'WITHDRAWN'
  | 'SUSPENDED'
  | 'ALUMNI';

export interface Student {
  id: string;
  schoolId: string;
  admissionNo: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  photoUrl?: string | null;
  /** When false the photo must not appear on public pages or documents. */
  photoConsent: boolean;
  admissionDate: string;
  status: StudentStatus;
  currentClassId?: string | null;
  currentClassName?: string | null;
  currentLevelName?: string | null;
  houseId?: string | null;
  houseName?: string | null;
  bloodGroup?: string | null;
  medicalNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  address?: string | null;
  nationality?: string | null;
  stateOfOrigin?: string | null;
  religion?: string | null;
  guardianCount: number;
  customFields?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StudentSummary {
  id: string;
  admissionNo: string;
  fullName: string;
  photoUrl?: string | null;
  photoConsent: boolean;
  className?: string | null;
  status: StudentStatus;
}

export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';

export interface Guardian {
  id: string;
  schoolId: string;
  userId?: string | null;
  title?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  altPhone?: string | null;
  occupation?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  hasPortalAccess: boolean;
  lastLoginAt?: string | null;
  studentCount: number;
  createdAt: string;
  version: number;
}

/** Many-to-many join carrying the qualities of the relationship itself. */
export interface StudentGuardianLink {
  id: string;
  studentId: string;
  studentName: string;
  studentAdmissionNo: string;
  studentPhotoUrl?: string | null;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isFinanciallyResponsible: boolean;
  canPickUp: boolean;
}

export interface StaffMember {
  id: string;
  schoolId: string;
  userId?: string | null;
  staffNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  gender: Gender;
  photoUrl?: string | null;
  designation: string;
  department?: string | null;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  employmentDate: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'EXITED';
  roleNames: string[];
  subjectIds: string[];
  subjectNames: string[];
  classIds: string[];
  classNames: string[];
  /**
   * The exact class/subject combinations this teacher is assigned — not
   * every pairing `classIds` × `subjectIds` implies. A teacher who teaches
   * Biology to JSS 1 and Mathematics to SSS 1 must not thereby appear to
   * teach Mathematics to JSS 1, which is what a plain cross-product of the
   * two flat lists would suggest.
   */
  teachingAssignments: { classId: string; subjectId: string }[];
  isFormTeacher: boolean;
  createdAt: string;
  version: number;
}

/** Historical academic placement — never overwritten, always appended. */
export interface StudentEnrollment {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  sessionName: string;
  termId?: string | null;
  termName?: string | null;
  levelId: string;
  levelName: string;
  classId: string;
  className: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PROMOTED' | 'REPEATED' | 'WITHDRAWN' | 'TRANSFERRED';
  enrolledOn: string;
  exitedOn?: string | null;
  note?: string | null;
}

export interface StudentDocument {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  category: 'BIRTH_CERTIFICATE' | 'PREVIOUS_RESULT' | 'MEDICAL' | 'PHOTO' | 'TRANSFER' | 'OTHER';
  storagePath: string;
  downloadUrl?: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
}

export interface PickupPerson {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  relationship: string;
  phone: string;
  photoUrl?: string | null;
  authorizationStatus: 'PENDING' | 'AUTHORIZED' | 'REVOKED';
  authorizedByName?: string | null;
  authorizedAt?: string | null;
  note?: string | null;
}

/** Immutable audit of a child actually leaving the premises. */
export interface CollectionEvent {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  studentAdmissionNo: string;
  className?: string | null;
  pickupPersonId?: string | null;
  pickupPersonName: string;
  relationship: string;
  releasedByStaffId: string;
  releasedByName: string;
  releasedAt: string;
  method: 'GATE' | 'BUS' | 'SELF' | 'OTHER';
  parentNotified: boolean;
  note?: string | null;
}
