import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
import { errors, latency, ok } from '../http-helpers';

const base = '/api/v1';

/** Session, school settings, academic structure and roles. */
export const coreHandlers = [
  http.get(`${base}/auth/session`, async ({ request }) => {
    await delay(latency());
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

  /* ---------------------------------------------------------------------- */
  /* Academic structure                                                      */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/academics/sessions`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.sessions, context.schoolId));
  }),

  http.get(`${base}/academics/terms`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const sessionId = new URL(request.url).searchParams.get('sessionId');
    const rows = scoped(db.terms, context.schoolId).filter(
      (term) => !sessionId || term.sessionId === sessionId,
    );
    return ok(rows);
  }),

  http.post(`${base}/academics/terms/:id/set-current`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const target = db.terms.find(
      (term) => term.id === params.id && term.schoolId === context.schoolId,
    );
    if (!target) return errors.notFound('Term');

    scoped(db.terms, context.schoolId).forEach((term) => {
      term.isCurrent = term.id === target.id;
      if (term.isCurrent) term.status = 'ACTIVE';
    });
    return ok(target, 'Current term updated');
  }),

  http.get(`${base}/academics/levels`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.levels, context.schoolId));
  }),

  http.get(`${base}/academics/classes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const levelId = new URL(request.url).searchParams.get('levelId');
    const rows = scoped(db.classes, context.schoolId).filter(
      (schoolClass) => !levelId || schoolClass.levelId === levelId,
    );
    return ok(rows);
  }),

  http.get(`${base}/academics/classes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const record = scoped(db.classes, context.schoolId).find((entry) => entry.id === params.id);
    return record ? ok(record) : errors.notFound('Class');
  }),

  http.get(`${base}/academics/subjects`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const levelId = new URL(request.url).searchParams.get('levelId');
    const rows = scoped(db.subjects, context.schoolId).filter(
      (subject) => !levelId || subject.levelIds.includes(levelId),
    );
    return ok(rows);
  }),

  http.get(`${base}/academics/rooms`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.rooms, context.schoolId));
  }),

  http.get(`${base}/academics/houses`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.houses, context.schoolId));
  }),

  /* ---------------------------------------------------------------------- */
  /* Files                                                                   */
  /* ---------------------------------------------------------------------- */

  http.post(`${base}/files/upload-target`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const body = (await request.json()) as { purpose: string; fileName: string };
    // The server names the object; a client-supplied filename never reaches
    // storage, which removes a whole class of path-traversal problems.
    const extension = body.fileName.split('.').pop() ?? 'bin';
    return ok({
      storagePath: `schools/${context.schoolId}/${body.purpose}/${crypto.randomUUID()}.${extension}`,
      uploadUrl: null,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* Audit                                                                   */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/audit`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('audit.read')) return errors.forbidden();

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const severity = url.searchParams.get('severity');
    const search = (url.searchParams.get('search') ?? '').toLowerCase();

    const rows = scoped(db.auditLog, context.schoolId).filter(
      (entry) =>
        (!action || entry.action === action) &&
        (!severity || entry.severity === severity) &&
        (!search ||
          entry.actorName.toLowerCase().includes(search) ||
          entry.action.toLowerCase().includes(search) ||
          (entry.entityLabel ?? '').toLowerCase().includes(search)),
    );

    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
    const start = (page - 1) * pageSize;

    return ok({
      items: rows.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        hasNext: start + pageSize < rows.length,
        hasPrevious: page > 1,
      },
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* Health                                                                  */
  /* ---------------------------------------------------------------------- */

  http.get('/api/health/live', () => ok({ status: 'ok' })),
  http.get('/api/health/ready', () => ok({ status: 'ok', database: 'mock', firebase: 'mock' })),
];
