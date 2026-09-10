import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Collection. */
export const collectionHandlers = [

  http.get(`${base}/collection/events`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const date = url.searchParams.get('date');
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.collectionEvents, context.schoolId);
    if (allowed) rows = rows.filter((event) => allowed.includes(event.studentId));

    rows = rows
      .filter(
        (event) =>
          (!date || event.releasedAt.slice(0, 10) === date) &&
          matchesSearch([event.studentName, event.pickupPersonName, event.studentAdmissionNo], search),
      )
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/collection/events`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      studentId: string;
      pickupPersonId: string;
      method: string;
      note?: string;
    };

    const student = db.students.find((entry) => entry.id === body.studentId);
    const person = db.pickupPersons.find((entry) => entry.id === body.pickupPersonId);
    if (!student || !person) return errors.validation('Select a student and an authorised person.');

    // Releasing a child to somebody not on the authorised list is refused
    // outright — this is the safety guarantee the feature exists for.
    if (person.authorizationStatus !== 'AUTHORIZED') {
      return errors.forbidden(
        `${person.name} is not currently authorised to collect ${student.firstName}.`,
      );
    }

    const event = {
      id: nextId('col'),
      schoolId: context.schoolId,
      studentId: student.id,
      studentName: student.fullName,
      studentAdmissionNo: student.admissionNo,
      className: student.currentClassName,
      pickupPersonId: person.id,
      pickupPersonName: person.name,
      relationship: person.relationship,
      releasedByStaffId: context.membership.staffId ?? context.user.id,
      releasedByName: context.user.displayName,
      releasedAt: new Date().toISOString(),
      method: body.method as never,
      parentNotified: true,
      note: body.note ?? null,
    };

    db.collectionEvents.unshift(event);
    db.notifications.unshift({
      id: nextId('ntf'),
      schoolId: context.schoolId,
      category: 'COLLECTION',
      title: `${student.firstName} has been collected`,
      body: `Collected by ${person.name} and released by ${context.user.displayName}.`,
      actionUrl: `/students/${student.id}?tab=pickup`,
      readAt: null,
      createdAt: new Date().toISOString(),
      severity: 'INFO',
      entityType: 'Student',
      entityId: student.id,
    });

    return created(event, 'Collection recorded and the parent notified');
  }),

  http.post(`${base}/students/:id/pickup`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | null>;
    const person = {
      id: nextId('pkp'),
      schoolId: context.schoolId,
      studentId: String(params.id),
      name: String(body.name),
      relationship: String(body.relationship),
      phone: String(body.phone),
      photoUrl: body.photoUrl ?? null,
      authorizationStatus: (body.authorizationStatus as never) ?? 'AUTHORIZED',
      authorizedByName: context.user.displayName,
      authorizedAt: new Date().toISOString(),
      note: body.note ?? null,
    };
    db.pickupPersons.push(person);
    return created(person, 'Authorised person added');
  }),

  http.patch(`${base}/students/:studentId/pickup/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const person = scoped(db.pickupPersons, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!person) return errors.notFound('Authorised person');

    Object.assign(person, await request.json());
    return ok(person, 'Authorised person updated');
  }),
];
