/** Matches `client/src/types/people.ts`. */
export interface GuardianDTO {
  id: string;
  schoolId: string;
  userId: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  altPhone: string | null;
  occupation: string | null;
  address: string | null;
  photoUrl: string | null;
  hasPortalAccess: boolean;
  lastLoginAt: string | null;
  studentCount: number;
  createdAt: string;
  version: number;
}

/**
 * The join, carrying both sides' details.
 *
 * The same shape serves "this child's guardians" and "this guardian's
 * children", which is why it names both rather than only the far side.
 */
export interface StudentGuardianLinkDTO {
  id: string;
  studentId: string;
  studentName: string;
  studentAdmissionNo: string;
  studentPhotoUrl: string | null;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isFinanciallyResponsible: boolean;
  canPickUp: boolean;
}
