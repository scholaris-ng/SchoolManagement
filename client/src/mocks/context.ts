import { buildSeed, type MockDb } from './seed';
import type { AuthenticatedUser, SchoolMembership } from '@/types/tenant';
import type { Permission } from '@/types/rbac';

/**
 * Request context for the mock API.
 *
 * The important behaviour modelled here is that the tenant is derived from the
 * *session*, never from the `X-School-Id` header alone — a client that names a
 * school it has no membership in is refused, exactly as the real server must
 * behave (spec section 4).
 */
export const db: MockDb = buildSeed();

export interface RequestContext {
  user: AuthenticatedUser;
  membership: SchoolMembership;
  schoolId: string;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
}

/** Identity + the membership a request is acting under, before any access check. */
export function findMembership(request: Request): { user: AuthenticatedUser; membership: SchoolMembership } | null {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token.startsWith('mock-token:')) return null;

  const email = token.slice('mock-token:'.length);
  const user = db.users.find((candidate) => candidate.email === email);
  if (!user) return null;

  const requestedSchoolId = request.headers.get('x-school-id');
  const membership =
    user.memberships.find((entry) => entry.schoolId === requestedSchoolId) ?? user.memberships[0];
  if (!membership) return null;

  return { user, membership };
}

/**
 * Why a staff membership may not be used right now, or `null` if it's fine.
 * A school's own roster is the single source of truth for this — there is no
 * separate "suspend this login" switch to forget to flip.
 */
export function staffBlockReason(membership: SchoolMembership): string | null {
  if (!membership.staffId) return null;
  const staff = db.staff.find((entry) => entry.id === membership.staffId);
  if (staff?.status === 'ON_LEAVE') {
    return 'This staff account is on leave and cannot sign in. Contact your school administrator.';
  }
  if (staff?.status === 'EXITED') {
    return 'This staff account has exited the school and can no longer sign in. Contact your school administrator.';
  }
  return null;
}

export function resolveContext(request: Request): RequestContext | null {
  const found = findMembership(request);
  if (!found) return null;
  const { user, membership } = found;

  // Blocked immediately, not just at the next sign-in: a school marking someone
  // on leave mid-session must not leave their existing session usable.
  if (staffBlockReason(membership)) return null;

  const permissions = membership.permissions;

  return {
    user,
    membership,
    schoolId: membership.schoolId,
    permissions,
    can: (permission) =>
      permissions.includes(permission) || permissions.includes('platform.manage'),
  };
}

/** Every list handler goes through this, so nothing can leak across tenants. */
export function scoped<T extends { schoolId: string }>(rows: T[], schoolId: string): T[] {
  return rows.filter((row) => row.schoolId === schoolId);
}

/**
 * A parent or student sees only their own records. This mirrors the row-level
 * restriction the API applies on top of permission checks.
 */
export function visibleStudentIds(context: RequestContext): string[] | null {
  if (context.membership.guardianId) {
    return db.studentGuardians
      .filter((link) => link.guardianId === context.membership.guardianId)
      .map((link) => link.studentId);
  }
  if (context.membership.studentId) return [context.membership.studentId];
  return null; // Staff see the whole school.
}
