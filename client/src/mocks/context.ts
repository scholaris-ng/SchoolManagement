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

export function resolveContext(request: Request): RequestContext | null {
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
