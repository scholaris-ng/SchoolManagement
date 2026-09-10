import { http, delay } from 'msw';
import {
  db,
  findMembership,
  resolveContext,
  scoped,
  staffBlockReason,
} from '../context';
import { errors, latency, ok } from '../http-helpers';

const base = '/api/v1';

/** Staff records for the ids a class's form-teacher field was set to, dropping any that don't resolve. */

/** Session, school settings, academic structure and roles. */

/** Routes for this module. */
export const sessionhandlersHandlers = [
  http.get(`${base}/auth/session`, async ({ request }) => {
    await delay(latency());

    // A blocked staff membership is a distinct, explainable failure — not the
    // same generic "you are not signed in" a missing/expired token gets.
    const found = findMembership(request);
    if (found) {
      const reason = staffBlockReason(found.membership);
      if (reason) return errors.forbidden(reason);
    }

    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok({ user: context.user, activeSchoolId: context.schoolId });
  }),

  http.patch(`${base}/users/me`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const patch = (await request.json()) as {
      displayName?: string;
      phone?: string | null;
      photoUrl?: string | null;
    };

    const user = db.users.find((entry) => entry.id === context.user.id);
    if (!user) return errors.notFound('User');

    if (patch.displayName !== undefined) {
      const name = patch.displayName.trim();
      if (name.length < 2) return errors.validation('Please enter your full name.');
      user.displayName = name;
    }
    // Memberships, roles and permissions are deliberately not patchable here:
    // a user can never grant themselves access to anything.
    if (patch.phone !== undefined) user.phone = patch.phone;
    if (patch.photoUrl !== undefined) user.photoUrl = patch.photoUrl;

    return ok(user, 'Profile updated');
  }),

  http.get(`${base}/schools/current`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const school = db.schools.find((entry) => entry.id === context.schoolId);
    return school ? ok(school) : errors.notFound('School');
  }),

  http.patch(`${base}/schools/current`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('settings.manage')) return errors.forbidden();

    const school = db.schools.find((entry) => entry.id === context.schoolId);
    if (!school) return errors.notFound('School');

    const ifMatch = request.headers.get('if-match');
    if (ifMatch && Number(ifMatch) !== school.version) return errors.versionConflict();

    const patch = (await request.json()) as Record<string, unknown>;
    Object.assign(school, patch, {
      branding: { ...school.branding, ...(patch.branding as object | undefined) },
      settings: { ...school.settings, ...(patch.settings as object | undefined) },
      version: school.version + 1,
      updatedAt: new Date().toISOString(),
    });

    // Memberships carry a copy of branding so the shell can re-skin instantly.
    db.users.forEach((user) =>
      user.memberships.forEach((membership) => {
        if (membership.schoolId === school.id) membership.branding = school.branding;
      }),
    );

    return ok(school, 'School settings saved');
  }),

  http.get(`${base}/roles`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('role.manage')) return errors.forbidden();
    return ok(scoped(db.roles as { schoolId: string }[], context.schoolId));
  }),

  http.patch(`${base}/roles/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('role.manage')) return errors.forbidden();

    const role = db.roles.find(
      (entry) => entry.id === params.id && entry.schoolId === context.schoolId,
    );
    if (!role) return errors.notFound('Role');

    const patch = (await request.json()) as { permissions?: string[]; name?: string };
    if (role.isSystem && patch.name) {
      return errors.validation('Built-in roles cannot be renamed.');
    }
    if (patch.permissions) role.permissions = patch.permissions as typeof role.permissions;

    db.auditLog.unshift({
      id: `aud_${Date.now()}`,
      schoolId: context.schoolId,
      actorUserId: context.user.id,
      actorName: context.user.displayName,
      actorRole: context.membership.roles[0] ?? 'Member',
      action: 'role.permissions_changed',
      entityType: 'Role',
      entityId: role.id,
      entityLabel: role.name,
      before: null,
      after: { permissions: role.permissions.length },
      ipAddress: null,
      userAgent: null,
      requestId: request.headers.get('x-request-id'),
      occurredAt: new Date().toISOString(),
      severity: 'CRITICAL',
    });

    return ok(role, 'Role updated');
  }),
];
