import type { Permission, RoleName } from '../../../config/constants';
import type { SchoolBranding } from '../../school/entities/school.entity';
import type { SchoolAccessDTO } from '../../school/services/schoolAccess';

/**
 * The session contract, matching `client/src/types/tenant.ts` field for field.
 *
 * Controllers and services deal in these; the entity classes never leave the
 * repository (`server_arch.md` section 9.4).
 */

export interface SchoolMembershipDTO {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolSlug: string;
  branchId: string | null;
  branchName: string | null;
  roles: RoleName[];
  customRoleNames: string[];
  permissions: Permission[];
  branding: SchoolBranding;
  /** The school's trial or activation — whether this school may be used right now. */
  access: SchoolAccessDTO;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  guardianId: string | null;
  studentId: string | null;
  staffId: string | null;
}

export interface AuthenticatedUserDTO {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  emailVerified: boolean;
  phone: string | null;
  photoUrl: string | null;
  isPlatformAdmin: boolean;
  /** May activate schools — shows the Schools screen. Decided by `SUBSCRIPTION_ADMIN_EMAILS`. */
  canManageSubscriptions: boolean;
  memberships: SchoolMembershipDTO[];
  createdAt: string;
}

export interface SessionDTO {
  user: AuthenticatedUserDTO;
  activeSchoolId: string | null;
}

export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  photoUrl?: string | null;
}
