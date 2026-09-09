import { http, delay } from 'msw';
import {
  academicScope,
  db,
  findMembership,
  formTeacherClassIds,
  resolveContext,
  scopeAllows,
  scoped,
  staffBlockReason,
} from '../context';
import { created, errors, latency, noContent, ok } from '../http-helpers';
import type {
  AcademicSession,
  House,
  Room,
  SchoolClass,
  SchoolLevel,
  Subject,
  Term,
} from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import { teachingWeeksBetween } from '@/lib/weekdays';

const base = '/api/v1';

let sequence = 100_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Staff records for the ids a class's form-teacher field was set to, dropping any that don't resolve. */
function resolveTeachers(ids: unknown): (typeof db.staff)[number][] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => db.staff.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof db.staff)[number] => Boolean(entry));
}

/** Session, school settings, academic structure and roles. */
export const coreHandlers = [
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

    // The session follows its term. Making a first-term-2026 term current
    // moves the whole school into that session, which is what everything
    // scoped by session — the curriculum above all — then reports on.
    scoped(db.sessions, context.schoolId).forEach((session) => {
      session.isCurrent = session.id === target.sessionId;
      if (session.isCurrent && session.status === 'PLANNED') session.status = 'ACTIVE';
    });

    return ok(target, 'Current term updated');
  }),

  http.post(`${base}/academics/sessions`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<AcademicSession> & { terms?: Partial<Term>[] };
    if (!body.name?.trim() || !body.startDate || !body.endDate) {
      return errors.validation('A session needs a name and a start and end date.');
    }

    const session: AcademicSession = {
      id: nextId('ses'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      startDate: body.startDate,
      endDate: body.endDate,
      isCurrent: false,
      status: 'PLANNED',
      termCount: body.terms?.length ?? 0,
    };
    db.sessions.push(session);

    (body.terms ?? []).forEach((term, index) => {
      const startDate = term.startDate ?? session.startDate;
      const endDate = term.endDate ?? session.endDate;
      db.terms.push({
        id: nextId('trm'),
        schoolId: context.schoolId,
        sessionId: session.id,
        sessionName: session.name,
        name: term.name?.trim() || `Term ${index + 1}`,
        sequence: index + 1,
        startDate,
        endDate,
        // Read off the dates, never taken from the request: a term's length is
        // a fact about when it runs.
        teachingWeeks: teachingWeeksBetween(startDate, endDate),
        isCurrent: false,
        status: 'PLANNED',
      });
    });

    return created(session, 'Academic session created');
  }),

  http.patch(`${base}/academics/sessions/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const session = scoped(db.sessions, context.schoolId).find((entry) => entry.id === params.id);
    if (!session) return errors.notFound('Academic session');

    const body = (await request.json()) as Partial<AcademicSession>;
    Object.assign(session, body);

    // Renaming a session should not orphan its terms' display name.
    if (body.name) {
      scoped(db.terms, context.schoolId)
        .filter((term) => term.sessionId === session.id)
        .forEach((term) => (term.sessionName = session.name));
    }

    return ok(session, 'Academic session updated');
  }),

  http.delete(`${base}/academics/sessions/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const session = scoped(db.sessions, context.schoolId).find((entry) => entry.id === params.id);
    if (!session) return errors.notFound('Academic session');
    if (session.isCurrent) {
      return errors.conflict(
        'This is the current session. Make another session current before deleting it.',
      );
    }

    const termIds = new Set(
      scoped(db.terms, context.schoolId)
        .filter((term) => term.sessionId === session.id)
        .map((term) => term.id),
    );
    db.sessions = db.sessions.filter((entry) => entry.id !== session.id);
    db.terms = db.terms.filter((entry) => !termIds.has(entry.id));

    return noContent();
  }),

  http.post(`${base}/academics/terms`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<Term> & { sessionId?: string };
    if (!body.sessionId) return errors.validation('A term must belong to a session.');
    const session = scoped(db.sessions, context.schoolId).find(
      (entry) => entry.id === body.sessionId,
    );
    if (!session) return errors.notFound('Academic session');
    if (!body.name?.trim() || !body.startDate || !body.endDate) {
      return errors.validation('A term needs a name and a start and end date.');
    }
    if (body.endDate < body.startDate) {
      return errors.validation('A term cannot end before it starts.');
    }

    const sequence =
      scoped(db.terms, context.schoolId).filter((term) => term.sessionId === session.id).length + 1;

    const term: Term = {
      id: nextId('trm'),
      schoolId: context.schoolId,
      sessionId: session.id,
      sessionName: session.name,
      name: body.name.trim(),
      sequence,
      startDate: body.startDate,
      endDate: body.endDate,
      teachingWeeks: teachingWeeksBetween(body.startDate, body.endDate),
      isCurrent: false,
      status: 'PLANNED',
    };
    db.terms.push(term);
    session.termCount += 1;

    return created(term, 'Term added');
  }),

  http.patch(`${base}/academics/terms/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const term = scoped(db.terms, context.schoolId).find((entry) => entry.id === params.id);
    if (!term) return errors.notFound('Term');

    const body = (await request.json()) as Partial<Term>;
    if (body.startDate && body.endDate && body.endDate < body.startDate) {
      return errors.validation('A term cannot end before it starts.');
    }
    Object.assign(term, body);

    // Recomputed rather than accepted, so moving a term's dates can never
    // leave a week count behind that a scheme of work would then plan against.
    term.teachingWeeks = teachingWeeksBetween(term.startDate, term.endDate);

    return ok(term, 'Term updated');
  }),

  http.get(`${base}/academics/periods`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.periods, context.schoolId).sort((a, b) => a.sequence - b.sequence));
  }),

  http.post(`${base}/academics/periods`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<TimetablePeriod>;
    if (!body.name?.trim() || !body.startTime || !body.endTime) {
      return errors.validation('A period needs a name, a start time and an end time.');
    }

    const period: TimetablePeriod = {
      id: nextId('per'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      startTime: body.startTime,
      endTime: body.endTime,
      sequence: body.sequence ?? scoped(db.periods, context.schoolId).length + 1,
      isBreak: body.isBreak ?? false,
    };
    db.periods.push(period);

    // The grid a school edits is the current timetable's own period list —
    // it was seeded as a copy of this array, so a new period is pushed there
    // too rather than left invisible until the timetable is regenerated.
    scoped(db.timetables, context.schoolId).forEach((timetable) => timetable.periods.push(period));

    return created(period, 'Period added');
  }),

  http.patch(`${base}/academics/periods/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const period = scoped(db.periods, context.schoolId).find((entry) => entry.id === params.id);
    if (!period) return errors.notFound('Period');

    const body = (await request.json()) as Partial<TimetablePeriod>;
    Object.assign(period, body);

    return ok(period, 'Period updated');
  }),

  http.delete(`${base}/academics/periods/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const period = scoped(db.periods, context.schoolId).find((entry) => entry.id === params.id);
    if (!period) return errors.notFound('Period');

    const inUse = scoped(db.timetables, context.schoolId).some((timetable) =>
      timetable.entries.some((entry) => entry.periodId === period.id),
    );
    if (inUse) {
      return errors.conflict(
        'This period has lessons scheduled in it. Remove them from the timetable first.',
      );
    }

    db.periods = db.periods.filter((entry) => entry.id !== period.id);
    scoped(db.timetables, context.schoolId).forEach((timetable) => {
      timetable.periods = timetable.periods.filter((entry) => entry.id !== period.id);
    });

    return noContent();
  }),

  http.get(`${base}/academics/levels`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    // Levels follow the classes the caller can see, so a JSS teacher is never
    // offered "SSS 3" in a filter that would only ever come back empty.
    const scope = academicScope(context);
    const rows = scoped(db.levels, context.schoolId);
    if (!scope.classIds) return ok(rows);

    const visibleLevelIds = new Set(
      scoped(db.classes, context.schoolId)
        .filter((entry) => scope.classIds!.includes(entry.id))
        .map((entry) => entry.levelId),
    );
    return ok(rows.filter((level) => visibleLevelIds.has(level.id)));
  }),

  http.post(`${base}/academics/levels`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<SchoolLevel>;
    if (!body.name?.trim()) return errors.validation('A level needs a name.');

    const level: SchoolLevel = {
      id: nextId('lvl'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      code: (body.code?.trim() || body.name.trim()).toUpperCase().replace(/\s+/g, ''),
      sequence: body.sequence ?? scoped(db.levels, context.schoolId).length + 1,
      gradingSchemeId: body.gradingSchemeId ?? null,
      gradingSchemeName: body.gradingSchemeName ?? null,
      classCount: 0,
    };
    db.levels.push(level);

    return created(level, 'Level added');
  }),

  http.patch(`${base}/academics/levels/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const level = scoped(db.levels, context.schoolId).find((entry) => entry.id === params.id);
    if (!level) return errors.notFound('Level');

    const body = (await request.json()) as Partial<SchoolLevel>;
    Object.assign(level, body);

    return ok(level, 'Level updated');
  }),

  http.get(`${base}/academics/classes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const url = new URL(request.url);
    const levelId = url.searchParams.get('levelId');
    // The register is the form teacher's job, not every teacher who passes
    // through the room — a narrower scope than the general academic one, so
    // the attendance page's class picker only offers classes worth picking.
    const formTeacherOnly = url.searchParams.get('formTeacherOnly') === 'true';
    const allowedIds = formTeacherOnly ? formTeacherClassIds(context) : academicScope(context).classIds;
    const rows = scoped(db.classes, context.schoolId).filter(
      (schoolClass) =>
        (!levelId || schoolClass.levelId === levelId) &&
        (!allowedIds || allowedIds.includes(schoolClass.id)),
    );
    return ok(rows);
  }),

  http.get(`${base}/academics/classes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const record = scoped(db.classes, context.schoolId).find((entry) => entry.id === params.id);
    if (!record) return errors.notFound('Class');
    // A class outside the caller's remit is "not found" rather than "forbidden":
    // its existence is not theirs to learn.
    const scope = academicScope(context);
    if (scope.classIds && !scope.classIds.includes(record.id)) return errors.notFound('Class');
    return ok(record);
  }),

  http.post(`${base}/academics/classes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<SchoolClass>;
    if (!body.name?.trim() || !body.levelId) {
      return errors.validation('A class needs a name and a level.');
    }
    const level = scoped(db.levels, context.schoolId).find((entry) => entry.id === body.levelId);
    if (!level) return errors.notFound('Level');
    const teachers = resolveTeachers(body.formTeacherIds);

    const schoolClass: SchoolClass = {
      id: nextId('cls'),
      schoolId: context.schoolId,
      levelId: level.id,
      levelName: level.name,
      name: body.name.trim(),
      arm: body.arm?.trim() || null,
      code: `${level.code}-${(scoped(db.classes, context.schoolId).length + 1).toString().padStart(2, '0')}`,
      capacity: body.capacity ?? 40,
      enrolledCount: 0,
      formTeacherIds: teachers.map((entry) => entry.id),
      formTeacherNames: teachers.map((entry) => entry.fullName),
      roomId: null,
      isActive: true,
    };
    db.classes.push(schoolClass);
    level.classCount += 1;

    return created(schoolClass, 'Class added');
  }),

  http.patch(`${base}/academics/classes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const schoolClass = scoped(db.classes, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!schoolClass) return errors.notFound('Class');

    const body = (await request.json()) as Partial<SchoolClass>;
    const level = body.levelId
      ? scoped(db.levels, context.schoolId).find((entry) => entry.id === body.levelId)
      : undefined;
    const teacherPatched = Object.prototype.hasOwnProperty.call(body, 'formTeacherIds');
    const teachers = teacherPatched ? resolveTeachers(body.formTeacherIds) : undefined;

    Object.assign(schoolClass, body, {
      levelName: level?.name ?? schoolClass.levelName,
      formTeacherNames: teachers ? teachers.map((entry) => entry.fullName) : schoolClass.formTeacherNames,
    });

    return ok(schoolClass, 'Class updated');
  }),

  http.get(`${base}/academics/subjects`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    // Asking for a class's subjects is asking for its level's subjects; doing
    // the lookup here keeps every caller from having to know that.
    const levelId =
      url.searchParams.get('levelId') ??
      (classId ? (db.classes.find((entry) => entry.id === classId)?.levelId ?? null) : null);

    const scope = academicScope(context);
    const rows = scoped(db.subjects, context.schoolId).filter(
      (subject) =>
        (!levelId || subject.levelIds.includes(levelId)) &&
        // Asked for a specific class: answer with the subjects actually
        // paired with that class, not "any subject at its level that this
        // teacher happens to teach somewhere" — the same independent-set
        // mistake curriculum visibility had. Without a class in the
        // question there is no pair to check, so the flat list still
        // answers "what do I teach at all" for a school-wide picker.
        (classId
          ? scopeAllows(scope, { classId, subjectId: subject.id })
          : !scope.subjectIds || scope.subjectIds.includes(subject.id)),
    );
    return ok(rows);
  }),

  http.post(`${base}/academics/subjects`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<Subject>;
    if (!body.name?.trim() || !body.code?.trim()) {
      return errors.validation('A subject needs a name and a code.');
    }
    const levelIds = body.levelIds ?? [];
    const levelNames = levelIds
      .map((id) => db.levels.find((entry) => entry.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    const subject: Subject = {
      id: nextId('sub'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      category: body.category?.trim() || null,
      isCore: body.isCore ?? true,
      levelIds,
      levelNames,
      teacherCount: 0,
      isActive: true,
      schedule: body.schedule ?? [],
    };
    db.subjects.push(subject);

    return created(subject, 'Subject added');
  }),

  http.patch(`${base}/academics/subjects/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const subject = scoped(db.subjects, context.schoolId).find((entry) => entry.id === params.id);
    if (!subject) return errors.notFound('Subject');

    const body = (await request.json()) as Partial<Subject>;
    const levelNames = body.levelIds
      ? body.levelIds
          .map((id) => db.levels.find((entry) => entry.id === id)?.name)
          .filter((name): name is string => Boolean(name))
      : undefined;

    Object.assign(subject, body, levelNames ? { levelNames } : {});

    return ok(subject, 'Subject updated');
  }),

  http.get(`${base}/academics/rooms`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.rooms, context.schoolId));
  }),

  http.post(`${base}/academics/rooms`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<Room>;
    if (!body.name?.trim()) return errors.validation('A room needs a name.');

    const room: Room = {
      id: nextId('rom'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      code: (body.code?.trim() || body.name.trim()).toUpperCase().replace(/\s+/g, ''),
      capacity: body.capacity ?? 30,
      type: body.type ?? 'CLASSROOM',
    };
    db.rooms.push(room);

    return created(room, 'Room added');
  }),

  http.patch(`${base}/academics/rooms/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const room = scoped(db.rooms, context.schoolId).find((entry) => entry.id === params.id);
    if (!room) return errors.notFound('Room');

    const body = (await request.json()) as Partial<Room>;
    Object.assign(room, body);

    return ok(room, 'Room updated');
  }),

  http.get(`${base}/academics/houses`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.houses, context.schoolId));
  }),

  http.post(`${base}/academics/houses`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<House>;
    if (!body.name?.trim()) return errors.validation('A house needs a name.');

    const house: House = {
      id: nextId('hse'),
      schoolId: context.schoolId,
      name: body.name.trim(),
      color: body.color?.trim() || '#2563eb',
      motto: body.motto?.trim() || null,
      captainStudentId: null,
      captainName: null,
      memberCount: 0,
      points: 0,
    };
    db.houses.push(house);

    return created(house, 'House added');
  }),

  http.patch(`${base}/academics/houses/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('academics.manage')) return errors.forbidden();

    const house = scoped(db.houses, context.schoolId).find((entry) => entry.id === params.id);
    if (!house) return errors.notFound('House');

    const body = (await request.json()) as Partial<House>;
    Object.assign(house, body);

    return ok(house, 'House updated');
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
