import type { Permission, RoleName } from '../../config/constants';

/** Identity, as answered by Firebase Authentication (spec section 5). */
export interface AuthIdentity {
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  photoUrl?: string | null;
}

/** What a user may do *within one school*. Resolved from PostgreSQL, never from the token. */
export interface MembershipContext {
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
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  guardianId: string | null;
  studentId: string | null;
  staffId: string | null;
}

export interface UserContext {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  phone: string | null;
  photoUrl: string | null;
  isPlatformAdmin: boolean;
}

/**
 * Everything downstream layers are allowed to know about the caller.
 *
 * Services receive this rather than the Express request, which is what keeps
 * business logic free of HTTP (spec section 2). `schoolId` is derived from the
 * membership, so a repository that scopes by `context.schoolId` cannot be talked
 * into reading another school's rows by a forged header.
 */
export interface RequestContext {
  user: UserContext;
  membership: MembershipContext;
  schoolId: string;
  permissions: Permission[];
  can(permission: Permission): boolean;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export function buildRequestContext(params: {
  user: UserContext;
  membership: MembershipContext;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): RequestContext {
  const permissions = params.membership.permissions;
  const granted = new Set<string>(permissions);
  return {
    user: params.user,
    membership: params.membership,
    schoolId: params.membership.schoolId,
    permissions,
    // `platform.manage` is the platform-operator escape hatch and implies all,
    // matching `client/src/lib/permissions.ts`.
    can: (permission) => granted.has(permission) || granted.has('platform.manage'),
    requestId: params.requestId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };
}
