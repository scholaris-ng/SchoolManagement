import { http, delay } from 'msw';
import {
  academicScope,
  db,
  formTeacherClassIds,
  resolveContext,
  scopeAllows,
  scoped,
} from '../context';
import {
  errors,
  latency,
  ok,
} from '../http-helpers';
import type {
  TimetableConflict,
  Weekday,
} from '@/types/curriculum';
import {
  base,
  nextId,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** Timetable. */
export const timetableHandlers = [

  http.get(`${base}/timetables/current`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('timetable.read')) return errors.forbidden();

    // "Current" means the timetable for the current term, not merely "the
    // school's only timetable" — a school keeps a separate timetable per
    // term, so switching which term is current must switch which timetable
    // this returns rather than relabelling whichever one already existed.
    const currentTerm = scoped(db.terms, context.schoolId).find((term) => term.isCurrent);
    const timetable = currentTerm
      ? scoped(db.timetables, context.schoolId).find((entry) => entry.termId === currentTerm.id)
      : undefined;
    if (!timetable) return errors.notFound('Timetable');

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const teacherId = url.searchParams.get('teacherId');
    const subjectId = url.searchParams.get('subjectId');

    // A teacher's own timetable is the classes and subjects they are
    // actually assigned to, not the whole school's schedule with a filter
    // they have to remember to apply — the same boundary curriculum and
    // attendance already enforce. A form teacher additionally sees the whole
    // of their own form class's schedule (every subject in it, not just the
    // ones they personally teach), same as the daily register — overseeing
    // that one class is the point of the role. Anyone who may manage the
    // timetable still needs the full picture to build it, so they are exempt.
    const scope = academicScope(context);
    const ownFormClassIds = formTeacherClassIds(context) ?? [];
    const canSeeEverything = context.can('timetable.manage');

    return ok({
      ...timetable,
      entries: timetable.entries.filter(
        (entry) =>
          (!classId || entry.classId === classId) &&
          (!teacherId || entry.teacherId === teacherId) &&
          (!subjectId || entry.subjectId === subjectId) &&
          (canSeeEverything ||
            ownFormClassIds.includes(entry.classId) ||
            scopeAllows(scope, { classId: entry.classId, subjectId: entry.subjectId })),
      ),
    });
  }),

  http.post(`${base}/timetables/:id/entries`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('timetable.manage')) return errors.forbidden();

    const timetable = scoped(db.timetables, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!timetable) return errors.notFound('Timetable');

    const body = (await request.json()) as {
      classId: string;
      subjectId: string;
      teacherId: string;
      roomId?: string | null;
      periodId: string;
      day: Weekday;
      entryId?: string;
    };

    // Clash detection is the whole point of the screen, so it is enforced here
    // rather than left to the UI (research feature 25).
    const conflicts: TimetableConflict[] = [];
    const period = timetable.periods.find((entry) => entry.id === body.periodId);

    timetable.entries
      .filter(
        (entry) =>
          entry.id !== body.entryId && entry.day === body.day && entry.periodId === body.periodId,
      )
      .forEach((entry) => {
        if (entry.teacherId === body.teacherId) {
          conflicts.push({
            type: 'TEACHER',
            day: body.day,
            periodName: period?.name ?? '',
            message: `${entry.teacherName} is already teaching ${entry.subjectName} to ${entry.className} in this period.`,
            entryIds: [entry.id],
          });
        }
        if (entry.classId === body.classId) {
          conflicts.push({
            type: 'CLASS',
            day: body.day,
            periodName: period?.name ?? '',
            message: `${entry.className} already has ${entry.subjectName} in this period.`,
            entryIds: [entry.id],
          });
        }
        if (body.roomId && entry.roomId === body.roomId) {
          conflicts.push({
            type: 'ROOM',
            day: body.day,
            periodName: period?.name ?? '',
            message: 'That room is already booked for this period.',
            entryIds: [entry.id],
          });
        }
      });

    if (conflicts.length > 0) {
      return errors.conflict(conflicts.map((conflict) => conflict.message).join(' '));
    }

    const schoolClass = db.classes.find((entry) => entry.id === body.classId)!;
    const subject = db.subjects.find((entry) => entry.id === body.subjectId)!;
    const teacher = db.staff.find((entry) => entry.id === body.teacherId)!;
    const room = body.roomId ? db.rooms.find((entry) => entry.id === body.roomId) : null;

    const entry = {
      id: body.entryId ?? nextId('tte'),
      schoolId: context.schoolId,
      timetableId: timetable.id,
      classId: schoolClass.id,
      className: schoolClass.name,
      subjectId: subject.id,
      subjectName: subject.name,
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
      periodId: body.periodId,
      periodName: period?.name ?? '',
      startTime: period?.startTime ?? '',
      endTime: period?.endTime ?? '',
      day: body.day,
    };

    const existingIndex = timetable.entries.findIndex((candidate) => candidate.id === entry.id);
    if (existingIndex >= 0) timetable.entries[existingIndex] = entry;
    else timetable.entries.push(entry);

    return ok(entry, 'Timetable updated');
  }),

  http.delete(`${base}/timetables/:id/entries/:entryId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('timetable.manage')) return errors.forbidden();

    const timetable = scoped(db.timetables, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!timetable) return errors.notFound('Timetable');

    timetable.entries = timetable.entries.filter((entry) => entry.id !== params.entryId);
    return ok({ removed: true }, 'Lesson removed from the timetable');
  }),

  http.delete(`${base}/timetables/:id/entries`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('timetable.manage')) return errors.forbidden();

    const timetable = scoped(db.timetables, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!timetable) return errors.notFound('Timetable');

    const removed = timetable.entries.length;
    timetable.entries = [];
    return ok({ removed }, 'Timetable cleared');
  }),
];
