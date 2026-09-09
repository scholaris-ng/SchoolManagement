import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import {
  created,
  errors,
  latency,
  matchesSearch,
  noContent,
  ok,
  paginate,
  readListParams,
  sortRows,
} from '../http-helpers';
import type { StaffMember, Student, StudentGuardianLink } from '@/types/people';

const base = '/api/v1';

let sequence = 90_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Students, guardians, staff and everything hanging off a student record. */
export const peopleHandlers = [
  http.get(`${base}/students`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search, sortBy, sortDir } = readListParams(url);
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.students, context.schoolId);
    if (allowed) rows = rows.filter((student) => allowed.includes(student.id));

    const status = url.searchParams.get('status');
    const classId = url.searchParams.get('classId');
    const levelId = url.searchParams.get('levelId');
    const gender = url.searchParams.get('gender');
    const houseId = url.searchParams.get('houseId');

    rows = rows.filter((student) => {
      if (status && student.status !== status) return false;
      if (classId && student.currentClassId !== classId) return false;
      if (gender && student.gender !== gender) return false;
      if (houseId && student.houseId !== houseId) return false;
      if (levelId) {
        const schoolClass = db.classes.find((entry) => entry.id === student.currentClassId);
        if (schoolClass?.levelId !== levelId) return false;
      }
      return matchesSearch(
        [student.fullName, student.admissionNo, student.currentClassName],
        search,
      );
    });

    const sorted = sortRows(
      rows as unknown as Record<string, unknown>[],
      sortBy === 'className' ? 'currentClassName' : sortBy,
      sortDir,
    ) as unknown as Student[];

    return ok(paginate(sorted, page, pageSize));
  }),

  http.get(`${base}/students/search`, async ({ request }) => {
    await delay(80);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.read')) return errors.forbidden();

    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.students, context.schoolId);
    if (allowed) rows = rows.filter((student) => allowed.includes(student.id));

    const matches = rows
      .filter((student) => matchesSearch([student.fullName, student.admissionNo], search))
      .slice(0, Number(url.searchParams.get('pageSize') ?? 8))
      .map((student) => ({
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: student.fullName,
        photoUrl: student.photoUrl,
        photoConsent: student.photoConsent,
        className: student.currentClassName,
        status: student.status,
      }));

    return ok(paginate(matches, 1, 8));
  }),

  http.get(`${base}/students/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.id))) {
      return errors.forbidden('That student is not linked to your account.');
    }

    const student = scoped(db.students, context.schoolId).find((entry) => entry.id === params.id);
    return student ? ok(student) : errors.notFound('Student');
  }),

  http.post(`${base}/students`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.create')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | boolean>;

    const duplicate = scoped(db.students, context.schoolId).some(
      (student) => student.admissionNo.toLowerCase() === String(body.admissionNo).toLowerCase(),
    );
    if (duplicate) {
      return errors.validation('That admission number is already in use.', [
        { field: 'admissionNo', message: 'Already used by another student in this school.' },
      ]);
    }

    const schoolClass = db.classes.find((entry) => entry.id === body.currentClassId);
    const house = db.houses.find((entry) => entry.id === body.houseId);

    const student: Student = {
      id: nextId('std'),
      schoolId: context.schoolId,
      admissionNo: String(body.admissionNo),
      firstName: String(body.firstName),
      middleName: (body.middleName as string) || null,
      lastName: String(body.lastName),
      fullName: [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' '),
      gender: body.gender as Student['gender'],
      dateOfBirth: String(body.dateOfBirth),
      photoUrl: (body.photoUrl as string) || null,
      photoConsent: Boolean(body.photoConsent),
      admissionDate: String(body.admissionDate),
      status: 'ACTIVE',
      currentClassId: schoolClass?.id ?? null,
      currentClassName: schoolClass?.name ?? null,
      currentLevelName: schoolClass?.levelName ?? null,
      houseId: house?.id ?? null,
      houseName: house?.name ?? null,
      bloodGroup: (body.bloodGroup as string) || null,
      medicalNotes: (body.medicalNotes as string) || null,
      emergencyContactName: (body.emergencyContactName as string) || null,
      emergencyContactPhone: (body.emergencyContactPhone as string) || null,
      address: (body.address as string) || null,
      nationality: (body.nationality as string) || null,
      stateOfOrigin: (body.stateOfOrigin as string) || null,
      religion: (body.religion as string) || null,
      guardianCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    db.students.unshift(student);
    if (schoolClass) schoolClass.enrolledCount += 1;

    const currentSession = scoped(db.sessions, context.schoolId).find((s) => s.isCurrent);
    const currentTerm = scoped(db.terms, context.schoolId).find((t) => t.isCurrent);
    if (currentSession && schoolClass) {
      db.enrollments.push({
        id: nextId('enr'),
        schoolId: context.schoolId,
        studentId: student.id,
        studentName: student.fullName,
        sessionId: currentSession.id,
        sessionName: currentSession.name,
        termId: currentTerm?.id ?? null,
        termName: currentTerm?.name ?? null,
        levelId: schoolClass.levelId,
        levelName: schoolClass.levelName,
        classId: schoolClass.id,
        className: schoolClass.name,
        status: 'ACTIVE',
        enrolledOn: student.admissionDate,
        exitedOn: null,
        note: 'Initial enrolment',
      });
    }

    return created(student, 'Student added');
  }),

  http.patch(`${base}/students/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.update')) return errors.forbidden();

    const student = scoped(db.students, context.schoolId).find((entry) => entry.id === params.id);
    if (!student) return errors.notFound('Student');

    const ifMatch = request.headers.get('if-match');
    if (ifMatch && Number(ifMatch) !== student.version) return errors.versionConflict();

    const body = (await request.json()) as Record<string, string | boolean>;
    const schoolClass = body.currentClassId
      ? db.classes.find((entry) => entry.id === body.currentClassId)
      : undefined;
    const house = body.houseId ? db.houses.find((entry) => entry.id === body.houseId) : undefined;

    Object.assign(student, body, {
      fullName: [
        body.firstName ?? student.firstName,
        body.middleName ?? student.middleName,
        body.lastName ?? student.lastName,
      ]
        .filter(Boolean)
        .join(' '),
      currentClassName: schoolClass?.name ?? student.currentClassName,
      currentLevelName: schoolClass?.levelName ?? student.currentLevelName,
      houseName: house?.name ?? student.houseName,
      updatedAt: new Date().toISOString(),
      version: student.version + 1,
    });

    return ok(student, 'Student updated');
  }),

  http.post(`${base}/students/:id/status`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.update')) return errors.forbidden();

    const student = scoped(db.students, context.schoolId).find((entry) => entry.id === params.id);
    if (!student) return errors.notFound('Student');

    const body = (await request.json()) as { status: Student['status']; effectiveDate: string; reason?: string };
    const before = student.status;
    student.status = body.status;
    student.version += 1;

    // Closing the current enrolment rather than deleting it keeps the academic
    // history the transcript is built from.
    const enrolment = db.enrollments.find(
      (entry) => entry.studentId === student.id && entry.status === 'ACTIVE',
    );
    if (enrolment && body.status !== 'ACTIVE') {
      enrolment.status = body.status === 'TRANSFERRED' ? 'TRANSFERRED' : 'WITHDRAWN';
      enrolment.exitedOn = body.effectiveDate;
      enrolment.note = body.reason ?? null;
    }

    db.auditLog.unshift({
      id: nextId('aud'),
      schoolId: context.schoolId,
      actorUserId: context.user.id,
      actorName: context.user.displayName,
      actorRole: context.membership.roles[0] ?? 'Member',
      action: 'student.status_changed',
      entityType: 'Student',
      entityId: student.id,
      entityLabel: `${student.fullName} — ${body.status.toLowerCase()}`,
      before: { status: before },
      after: { status: body.status, reason: body.reason },
      ipAddress: null,
      userAgent: null,
      requestId: request.headers.get('x-request-id'),
      occurredAt: new Date().toISOString(),
      severity: 'WARNING',
    });

    return ok(student, 'Student status updated');
  }),

  http.post(`${base}/students/promotions`, async ({ request }) => {
    await delay(latency() * 2);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.promote')) return errors.forbidden();

    const body = (await request.json()) as {
      fromClassId: string;
      toClassId: string;
      nextSessionId: string;
      repeatStudentIds: string[];
      graduateStudentIds: string[];
    };

    const target = db.classes.find((entry) => entry.id === body.toClassId);
    const session = db.sessions.find((entry) => entry.id === body.nextSessionId);
    if (!target || !session) return errors.validation('Select both a destination class and session.');

    const roster = scoped(db.students, context.schoolId).filter(
      (student) => student.currentClassId === body.fromClassId && student.status === 'ACTIVE',
    );

    let promoted = 0;
    let repeated = 0;
    let graduated = 0;

    roster.forEach((student) => {
      const previous = db.enrollments.find(
        (entry) => entry.studentId === student.id && entry.status === 'ACTIVE',
      );
      if (previous) {
        previous.status = body.graduateStudentIds.includes(student.id)
          ? 'COMPLETED'
          : body.repeatStudentIds.includes(student.id)
            ? 'REPEATED'
            : 'PROMOTED';
        previous.exitedOn = new Date().toISOString().slice(0, 10);
      }

      if (body.graduateStudentIds.includes(student.id)) {
        student.status = 'GRADUATED';
        graduated += 1;
        return;
      }

      const destination = body.repeatStudentIds.includes(student.id)
        ? db.classes.find((entry) => entry.id === body.fromClassId)!
        : target;

      student.currentClassId = destination.id;
      student.currentClassName = destination.name;
      student.currentLevelName = destination.levelName;
      student.version += 1;

      db.enrollments.push({
        id: nextId('enr'),
        schoolId: context.schoolId,
        studentId: student.id,
        studentName: student.fullName,
        sessionId: session.id,
        sessionName: session.name,
        termId: null,
        termName: null,
        levelId: destination.levelId,
        levelName: destination.levelName,
        classId: destination.id,
        className: destination.name,
        status: 'ACTIVE',
        enrolledOn: session.startDate,
        exitedOn: null,
        note: body.repeatStudentIds.includes(student.id) ? 'Repeating the class' : 'Promoted',
      });

      if (body.repeatStudentIds.includes(student.id)) repeated += 1;
      else promoted += 1;
    });

    return ok({ promoted, repeated, graduated }, 'Promotion complete');
  }),

  http.get(`${base}/students/:id/enrollments`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const rows = scoped(db.enrollments, context.schoolId)
      .filter((entry) => entry.studentId === params.id)
      .sort((a, b) => b.enrolledOn.localeCompare(a.enrolledOn));
    return ok(rows);
  }),

  http.get(`${base}/students/:id/guardians`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.read')) return errors.forbidden();
    return ok(db.studentGuardians.filter((link) => link.studentId === params.id));
  }),

  http.post(`${base}/students/:id/guardians`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.manage')) return errors.forbidden();

    const body = (await request.json()) as Omit<StudentGuardianLink, 'id'> & { guardianId: string };
    const student = db.students.find((entry) => entry.id === params.id);
    const guardian = db.guardians.find((entry) => entry.id === body.guardianId);
    if (!student || !guardian) return errors.notFound('Student or guardian');

    if (db.studentGuardians.some((l) => l.studentId === student.id && l.guardianId === guardian.id)) {
      return errors.conflict('That guardian is already linked to this student.');
    }

    const link: StudentGuardianLink = {
      id: nextId('sgl'),
      studentId: student.id,
      studentName: student.fullName,
      studentAdmissionNo: student.admissionNo,
      studentPhotoUrl: student.photoUrl,
      guardianId: guardian.id,
      guardianName: guardian.fullName,
      guardianPhone: guardian.phone,
      guardianEmail: guardian.email,
      relationship: body.relationship,
      isPrimaryContact: body.isPrimaryContact,
      isEmergencyContact: body.isEmergencyContact,
      isFinanciallyResponsible: body.isFinanciallyResponsible,
      canPickUp: body.canPickUp,
    };

    db.studentGuardians.push(link);
    student.guardianCount += 1;
    guardian.studentCount += 1;

    return created(link, 'Guardian linked');
  }),

  http.delete(`${base}/students/:studentId/guardians/:linkId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.manage')) return errors.forbidden();

    const index = db.studentGuardians.findIndex((link) => link.id === params.linkId);
    if (index === -1) return errors.notFound('Link');

    const [link] = db.studentGuardians.splice(index, 1);
    const student = db.students.find((entry) => entry.id === link.studentId);
    const guardian = db.guardians.find((entry) => entry.id === link.guardianId);
    if (student) student.guardianCount = Math.max(0, student.guardianCount - 1);
    if (guardian) guardian.studentCount = Math.max(0, guardian.studentCount - 1);

    return noContent();
  }),

  http.get(`${base}/students/:id/documents`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(
      db.students.some((s) => s.id === params.id && s.schoolId === context.schoolId) ? [] : [],
    );
  }),

  http.get(`${base}/students/:id/pickup`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.read')) return errors.forbidden();

    return ok({
      persons: scoped(db.pickupPersons, context.schoolId).filter((p) => p.studentId === params.id),
      recentEvents: scoped(db.collectionEvents, context.schoolId)
        .filter((event) => event.studentId === params.id)
        .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
        .slice(0, 10),
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* Guardians                                                               */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/guardians`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search, sortBy, sortDir } = readListParams(url);
    const hasAccess = url.searchParams.get('hasPortalAccess');

    const rows = scoped(db.guardians, context.schoolId).filter(
      (guardian) =>
        (!hasAccess || String(guardian.hasPortalAccess) === hasAccess) &&
        matchesSearch([guardian.fullName, guardian.email, guardian.phone], search),
    );

    return ok(
      paginate(
        sortRows(rows as unknown as Record<string, unknown>[], sortBy, sortDir) as unknown as typeof rows,
        page,
        pageSize,
      ),
    );
  }),

  http.get(`${base}/guardians/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const guardian = scoped(db.guardians, context.schoolId).find((entry) => entry.id === params.id);
    return guardian ? ok(guardian) : errors.notFound('Guardian');
  }),

  http.get(`${base}/guardians/:id/children`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(db.studentGuardians.filter((link) => link.guardianId === params.id));
  }),

  http.post(`${base}/guardians`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | boolean>;
    if (
      scoped(db.guardians, context.schoolId).some(
        (guardian) => guardian.email.toLowerCase() === String(body.email).toLowerCase(),
      )
    ) {
      return errors.validation('A guardian with that email already exists.', [
        { field: 'email', message: 'Already registered in this school.' },
      ]);
    }

    const guardian = {
      id: nextId('gdn'),
      schoolId: context.schoolId,
      userId: null,
      title: (body.title as string) || null,
      firstName: String(body.firstName),
      lastName: String(body.lastName),
      fullName: `${body.firstName} ${body.lastName}`,
      email: String(body.email),
      phone: String(body.phone),
      altPhone: (body.altPhone as string) || null,
      occupation: (body.occupation as string) || null,
      address: (body.address as string) || null,
      photoUrl: null,
      hasPortalAccess: Boolean(body.grantPortalAccess),
      lastLoginAt: null,
      studentCount: 0,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    db.guardians.unshift(guardian);
    return created(guardian, 'Guardian added');
  }),

  http.post(`${base}/guardians/:id/invite`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('guardian.manage')) return errors.forbidden();

    const guardian = scoped(db.guardians, context.schoolId).find((entry) => entry.id === params.id);
    if (!guardian) return errors.notFound('Guardian');
    guardian.hasPortalAccess = true;
    return ok({ invited: true, email: guardian.email }, 'Invitation sent');
  }),

  /* ---------------------------------------------------------------------- */
  /* Staff                                                                   */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/staff`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('staff.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search, sortBy, sortDir } = readListParams(url);
    const status = url.searchParams.get('status');
    const department = url.searchParams.get('department');

    const rows = scoped(db.staff, context.schoolId).filter(
      (member) =>
        (!status || member.status === status) &&
        (!department || member.department === department) &&
        matchesSearch([member.fullName, member.staffNo, member.email, member.designation], search),
    );

    return ok(
      paginate(
        sortRows(rows as unknown as Record<string, unknown>[], sortBy, sortDir) as unknown as typeof rows,
        page,
        pageSize,
      ),
    );
  }),

  http.get(`${base}/staff/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const member = scoped(db.staff, context.schoolId).find((entry) => entry.id === params.id);
    return member ? ok(member) : errors.notFound('Staff member');
  }),

  http.post(`${base}/staff`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('staff.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, unknown>;

    if (
      scoped(db.staff, context.schoolId).some(
        (member) => member.staffNo.toLowerCase() === String(body.staffNo).toLowerCase(),
      )
    ) {
      return errors.validation('That staff number is already in use.', [
        { field: 'staffNo', message: 'Already used by another staff member in this school.' },
      ]);
    }
    if (
      scoped(db.staff, context.schoolId).some(
        (member) => member.email.toLowerCase() === String(body.email).toLowerCase(),
      )
    ) {
      return errors.validation('That email is already in use.', [
        { field: 'email', message: 'Already used by another staff member in this school.' },
      ]);
    }

    const subjectIds = (body.subjectIds as string[] | undefined) ?? [];
    const classIds = (body.classIds as string[] | undefined) ?? [];
    const subjects = subjectIds
      .map((entryId) => db.subjects.find((subject) => subject.id === entryId))
      .filter(Boolean) as typeof db.subjects;
    const classes = classIds
      .map((entryId) => db.classes.find((schoolClass) => schoolClass.id === entryId))
      .filter(Boolean) as typeof db.classes;

    const member: StaffMember = {
      id: nextId('stf'),
      schoolId: context.schoolId,
      userId: null,
      staffNo: String(body.staffNo),
      firstName: String(body.firstName),
      lastName: String(body.lastName),
      fullName: `${body.firstName} ${body.lastName}`,
      email: String(body.email),
      phone: String(body.phone),
      gender: body.gender as StaffMember['gender'],
      photoUrl: (body.photoUrl as string) || null,
      designation: String(body.designation),
      department: (body.department as string) || null,
      employmentType: body.employmentType as StaffMember['employmentType'],
      employmentDate: String(body.employmentDate),
      status: (body.status as StaffMember['status']) ?? 'ACTIVE',
      roleNames: (body.roleNames as StaffMember['roleNames']) ?? [],
      subjectIds: subjects.map((subject) => subject.id),
      subjectNames: subjects.map((subject) => subject.name),
      classIds: classes.map((schoolClass) => schoolClass.id),
      classNames: classes.map((schoolClass) => schoolClass.name),
      // The form assigns classes and subjects as two separate lists rather
      // than named pairs, so every combination is taken as an assignment —
      // an approximation, but a deliberate one an admin actually made, not
      // random noise from two unrelated lists (research: curriculum
      // visibility must not cross-contaminate class and subject scope).
      teachingAssignments: classes.flatMap((schoolClass) =>
        subjects.map((subject) => ({ classId: schoolClass.id, subjectId: subject.id })),
      ),
      isFormTeacher: Boolean(body.isFormTeacher),
      createdAt: new Date().toISOString(),
      version: 1,
    };

    db.staff.unshift(member);
    return created(member, 'Staff member added');
  }),

  http.patch(`${base}/staff/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('staff.manage')) return errors.forbidden();

    const member = scoped(db.staff, context.schoolId).find((entry) => entry.id === params.id);
    if (!member) return errors.notFound('Staff member');

    const ifMatch = request.headers.get('if-match');
    if (ifMatch && Number(ifMatch) !== member.version) return errors.versionConflict();

    const body = (await request.json()) as Record<string, unknown>;
    const previousStatus = member.status;

    const subjectIds = (body.subjectIds as string[] | undefined) ?? member.subjectIds;
    const classIds = (body.classIds as string[] | undefined) ?? member.classIds;
    const subjects = subjectIds
      .map((entryId) => db.subjects.find((subject) => subject.id === entryId))
      .filter(Boolean) as typeof db.subjects;
    const classes = classIds
      .map((entryId) => db.classes.find((schoolClass) => schoolClass.id === entryId))
      .filter(Boolean) as typeof db.classes;

    // Only recompute the pairing when the admin actually touched the class
    // or subject lists in this edit — otherwise an unrelated change (e.g. a
    // phone number) would blow away precise, deliberately-seeded pairs and
    // fall back to a blunt cross-product of whatever happened to be on the
    // record already.
    const teachingAssignments =
      body.subjectIds !== undefined || body.classIds !== undefined
        ? classes.flatMap((schoolClass) =>
            subjects.map((subject) => ({ classId: schoolClass.id, subjectId: subject.id })),
          )
        : member.teachingAssignments;

    Object.assign(member, body, {
      fullName: [body.firstName ?? member.firstName, body.lastName ?? member.lastName]
        .filter(Boolean)
        .join(' '),
      subjectIds: subjects.map((subject) => subject.id),
      subjectNames: subjects.map((subject) => subject.name),
      classIds: classes.map((schoolClass) => schoolClass.id),
      classNames: classes.map((schoolClass) => schoolClass.name),
      teachingAssignments,
      version: member.version + 1,
    });

    // A status change into or out of "on leave"/"exited" is exactly what stops
    // (or restores) that person's ability to sign in — worth its own trail.
    if (body.status && body.status !== previousStatus) {
      db.auditLog.unshift({
        id: nextId('aud'),
        schoolId: context.schoolId,
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        actorRole: context.membership.roles[0] ?? 'Member',
        action: 'staff.status_changed',
        entityType: 'StaffMember',
        entityId: member.id,
        entityLabel: `${member.fullName} — ${String(body.status).toLowerCase().replace('_', ' ')}`,
        before: { status: previousStatus },
        after: { status: body.status },
        ipAddress: null,
        userAgent: null,
        requestId: request.headers.get('x-request-id'),
        occurredAt: new Date().toISOString(),
        severity: previousStatus === 'ACTIVE' ? 'WARNING' : 'INFO',
      });
    }

    return ok(member, 'Staff record updated');
  }),
];
