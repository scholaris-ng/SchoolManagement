import type { Permission, RoleName } from './rbac';

export interface SchoolBranding {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  motto?: string | null;
}

export interface SchoolSettings {
  timezone: string;
  currency: string;
  currencySymbol: string;
  country: string;
  locale: string;
  /** Students' photographs are hidden from public surfaces unless consented. */
  requirePhotoConsent: boolean;
  absenceAlertEnabled: boolean;
  absenceAlertCutoff: string; // HH:mm local time
  resultPublishNotification: boolean;
  allowParentTeacherMessaging: boolean;
}

export interface School {
  id: string;
  name: string;
  shortName: string;
  code: string;
  email: string;
  phone: string;
  website?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  branding: SchoolBranding;
  settings: SchoolSettings;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SchoolBranch {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  isHeadOffice: boolean;
}

/**
 * What the authenticated user is allowed to do *within one school*. A user may
 * hold several memberships; the active one drives navigation and every query.
 */
export interface SchoolMembership {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolSlug: string;
  branchId?: string | null;
  branchName?: string | null;
  roles: RoleName[];
  customRoleNames: string[];
  permissions: Permission[];
  branding: SchoolBranding;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  /** Present when the membership is a parent/guardian record. */
  guardianId?: string | null;
  /** Present when the membership is a student record. */
  studentId?: string | null;
  /** Present for staff memberships. */
  staffId?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * The two parts joined, kept by the server so every screen has one name
   * to render without deciding how to assemble it.
   */
  displayName: string;
  phone?: string | null;
  photoUrl?: string | null;
  isPlatformAdmin: boolean;
  memberships: SchoolMembership[];
  createdAt: string;
}

/** Response of `GET /api/v1/auth/session`. */
export interface SessionPayload {
  user: AuthenticatedUser;
  activeSchoolId: string | null;
}
