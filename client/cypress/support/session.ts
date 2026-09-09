import { permissionsForRoles } from '@/mocks/personas';
import type { RoleName } from '@/types/rbac';
import type { AuthenticatedUser, SchoolMembership, SessionPayload } from '@/types/tenant';

/**
 * Builds the stubbed session the app sees after `cy.login()`.
 *
 * Permissions are derived from the same role matrix the product uses
 * (`src/mocks/personas.ts`) rather than a copy kept here, so a permission added
 * to a role cannot silently drift out of the E2E suite.
 */

export type TestRole = 'admin' | 'principal' | 'teacher' | 'bursar' | 'parent' | 'student';

const ROLES: Record<TestRole, RoleName[]> = {
  admin: ['SCHOOL_ADMIN'],
  principal: ['PRINCIPAL'],
  teacher: ['TEACHER', 'FORM_TEACHER'],
  bursar: ['BURSAR'],
  parent: ['PARENT'],
  student: ['STUDENT'],
};

export const TEST_SCHOOL_ID = 'e2e-school-1';

export function membershipFor(role: TestRole): SchoolMembership {
  return {
    id: `e2e-membership-${role}`,
    schoolId: TEST_SCHOOL_ID,
    schoolName: 'Brightfield Academy',
    schoolShortName: 'Brightfield',
    schoolSlug: 'brightfield',
    branchId: null,
    branchName: null,
    roles: ROLES[role],
    customRoleNames: [],
    permissions: permissionsForRoles(ROLES[role]),
    branding: {
      primaryColor: '#1d4ed8',
      accentColor: '#0f766e',
      logoUrl: null,
      faviconUrl: null,
      motto: 'Knowledge and character',
    },
    status: 'ACTIVE',
    guardianId: role === 'parent' ? 'e2e-guardian-1' : null,
    studentId: role === 'student' ? 'e2e-student-1' : null,
    staffId: role === 'teacher' || role === 'bursar' ? 'e2e-staff-1' : null,
  };
}

export function userFor(role: TestRole): AuthenticatedUser {
  return {
    id: `e2e-user-${role}`,
    firebaseUid: `mock-e2e-${role}`,
    email: `${role}@e2e.test`,
    displayName: `E2E ${role}`,
    phone: null,
    photoUrl: null,
    isPlatformAdmin: false,
    memberships: [membershipFor(role)],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export function sessionFor(role: TestRole, overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { user: userFor(role), activeSchoolId: TEST_SCHOOL_ID, ...overrides };
}

/** The shape `MockIdentityProvider` stores under `scholaris:mock-persona`. */
export function identityFor(role: TestRole) {
  const user = userFor(role);
  return {
    uid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: null,
    emailVerified: true,
  };
}
