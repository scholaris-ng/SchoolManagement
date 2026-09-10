import { http, delay } from 'msw';
import {
  db,
  resolveContext,
  scoped,
} from '../context';
import {
  created,
  errors,
  latency,
  matchesSearch,
  noContent,
  ok,
  paginate,
  readListParams,
} from '../http-helpers';
import {
  base,
  nextId,
  canEditScheme,
  SCHEME_NOT_YOURS,
  canEditLessonNote,
  LESSON_NOTE_NOT_YOURS,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** Routes for this module. */

/** Lesson notes. */
export const lessonNoteHandlers = [
  http.get(`${base}/lesson-notes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const status = url.searchParams.get('status');
    const classId = url.searchParams.get('classId');
    const subjectId = url.searchParams.get('subjectId');

    // A plain teacher's list is their own lesson notes; a reviewer's is
    // everyone's, because reviewing is the point of holding that permission.
    const rows = scoped(db.lessonNotes, context.schoolId)
      .filter(
        (note) =>
          (!status || note.status === status) &&
          (!classId || note.classId === classId) &&
          (!subjectId || note.subjectId === subjectId) &&
          matchesSearch([note.topic, note.teacherName, note.className, note.subjectName], search) &&
          canEditLessonNote(context, note),
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/lesson-notes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.read')) return errors.forbidden();
    const note = scoped(db.lessonNotes, context.schoolId).find((entry) => entry.id === params.id);
    if (!note) return errors.notFound('Lesson note');
    // The list already hides another teacher's notes; a link followed
    // straight to one must refuse the same way, or the list's filtering is
    // theatre.
    if (!canEditLessonNote(context, note)) return errors.notFound('Lesson note');
    return ok(note);
  }),

  http.post(`${base}/lesson-notes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string>;
    const scheme = scoped(db.schemes, context.schoolId).find((entry) => entry.id === body.schemeId);
    if (!scheme) return errors.validation('Choose a scheme of work.');
    // Writing a note against a scheme is a form of using it, same rule as
    // editing one: your own, or a class and subject you are assigned to.
    if (!canEditScheme(context, scheme)) return errors.forbidden(SCHEME_NOT_YOURS);
    const week = scheme.weeks.find((entry) => entry.id === body.schemeWeekId);
    if (!week) return errors.validation('Choose a week from that scheme.');
    if (week.isBreak) return errors.validation('That week is a break — there is nothing to log.');

    // Class, subject, topic and objectives all come from the scheme week —
    // duplicating them as separate free-text fields is exactly what let a
    // note drift from the plan it was supposedly following.
    const note = {
      id: nextId('lsn'),
      schoolId: context.schoolId,
      teacherId: context.membership.staffId ?? 'staff_unknown',
      teacherName: context.user.displayName,
      schemeId: scheme.id,
      schemeWeekId: week.id,
      classId: scheme.classId,
      className: scheme.className,
      subjectId: scheme.subjectId,
      subjectName: scheme.subjectName,
      termId: scheme.termId,
      weekNumber: week.weekNumber,
      date: String(body.date),
      topic: week.topicTitle,
      objectiveIds: week.objectiveIds,
      objectiveStatements: week.objectiveStatements,
      content: String(body.content),
      resources: week.resources ?? null,
      assignment: (body.assignment as string) || null,
      challenges: (body.challenges as string) || null,
      studentDifficulties: (body.studentDifficulties as string) || null,
      status: (body.status as 'DRAFT' | 'SUBMITTED') ?? 'DRAFT',
      reviewerName: null,
      reviewedAt: null,
      reviewComment: null,
      version: 1,
    };

    db.lessonNotes.unshift(note);
    return created(note, 'Lesson note saved');
  }),

  http.patch(`${base}/lesson-notes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const note = scoped(db.lessonNotes, context.schoolId).find((entry) => entry.id === params.id);
    if (!note) return errors.notFound('Lesson note');

    const body = (await request.json()) as Record<string, unknown>;
    if (
      (body.status === 'APPROVED' || body.status === 'RETURNED') &&
      !context.can('lessonnote.approve')
    ) {
      return errors.forbidden();
    }
    if (!context.can('lessonnote.manage') && !context.can('lessonnote.approve')) {
      return errors.forbidden();
    }
    // `lessonnote.manage` on its own is a school-wide permission, but editing
    // someone else's note is not what it is for — that needs authorship or a
    // reviewer's standing, same as reading one.
    if (!canEditLessonNote(context, note)) return errors.forbidden(LESSON_NOTE_NOT_YOURS);

    Object.assign(note, body, { version: note.version + 1 });
    if (body.status === 'APPROVED' || body.status === 'RETURNED') {
      note.reviewerName = context.user.displayName;
      note.reviewedAt = new Date().toISOString();
    }

    return ok(note, 'Lesson note updated');
  }),

  http.delete(`${base}/lesson-notes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.manage')) return errors.forbidden();

    const note = scoped(db.lessonNotes, context.schoolId).find((entry) => entry.id === params.id);
    if (!note) return errors.notFound('Lesson note');

    // Deleting is stricter than editing: a reviewer may return or approve a
    // note without owning it, but removing someone else's record outright
    // needs authorship or a coordinator, the same line curricula draw.
    if (!context.can('academics.manage') && note.teacherId !== context.membership.staffId) {
      return errors.forbidden(
        'Only the teacher who wrote this note, or a coordinator, can delete it.',
      );
    }

    db.lessonNotes = db.lessonNotes.filter((entry) => entry.id !== note.id);
    return noContent();
  }),

  http.post(`${base}/lesson-notes/bulk-delete`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.manage')) return errors.forbidden();

    const body = (await request.json()) as { ids?: string[] };
    const requestedIds = Array.from(new Set(body.ids ?? []));
    if (requestedIds.length === 0) {
      return errors.validation('Select at least one lesson note to delete.');
    }

    const notes = scoped(db.lessonNotes, context.schoolId).filter((entry) =>
      requestedIds.includes(entry.id),
    );
    // Same rule as a single delete, checked for every note in the batch
    // before any of them are removed — a selection that mixes in someone
    // else's note is refused whole, not partly actioned.
    const unauthorized = notes.filter(
      (note) => !context.can('academics.manage') && note.teacherId !== context.membership.staffId,
    );
    if (unauthorized.length > 0) {
      return errors.forbidden(
        unauthorized.length === 1
          ? 'One of the selected notes belongs to another teacher and cannot be deleted.'
          : `${unauthorized.length} of the selected notes belong to another teacher and cannot be deleted.`,
      );
    }

    const deletableIds = new Set(notes.map((note) => note.id));
    db.lessonNotes = db.lessonNotes.filter((entry) => !deletableIds.has(entry.id));
    return ok(
      { deleted: deletableIds.size },
      `${deletableIds.size} lesson note${deletableIds.size === 1 ? '' : 's'} deleted`,
    );
  }),
];
