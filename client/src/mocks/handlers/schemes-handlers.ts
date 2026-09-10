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
  ok,
  paginate,
  readListParams,
} from '../http-helpers';
import {
  base,
  nextId,
  canEditCurriculum,
  NOT_YOURS,
  canEditScheme,
  SCHEME_NOT_YOURS,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** Routes for this module. */

/** Schemes of work. */
export const schemesHandlers = [
  http.get(`${base}/schemes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('scheme.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const classId = url.searchParams.get('classId');
    const subjectId = url.searchParams.get('subjectId');
    const status = url.searchParams.get('status');
    const createdById = url.searchParams.get('createdById');

    // A teacher's list is the schemes for the classes and subjects they
    // teach, or the ones they wrote themselves — the same boundary curricula
    // already enforce.
    const rows = scoped(db.schemes, context.schoolId)
      .filter(
        (scheme) =>
          (!classId || scheme.classId === classId) &&
          (!subjectId || scheme.subjectId === subjectId) &&
          (!status || scheme.status === status) &&
          (!createdById || scheme.createdById === createdById) &&
          canEditScheme(context, scheme),
      )
      .map(({ weeks: _weeks, ...rest }) => ({ ...rest, weeks: [], weekCount: _weeks.length }));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/schemes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('scheme.read')) return errors.forbidden();
    const scheme = scoped(db.schemes, context.schoolId).find((entry) => entry.id === params.id);
    if (!scheme) return errors.notFound('Scheme of work');
    // The list already hides a scheme outside a teacher's classes and
    // subjects; a link followed straight to it must refuse the same way, or
    // the list's filtering is theatre.
    if (!canEditScheme(context, scheme)) return errors.notFound('Scheme of work');
    return ok(scheme);
  }),

  http.post(`${base}/schemes/generate`, async ({ request }) => {
    await delay(latency() * 2);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('scheme.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      curriculumId: string;
      classId?: string;
      termId: string;
    };

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === body.curriculumId,
    );
    const term = db.terms.find((entry) => entry.id === body.termId);
    if (!curriculum || !term) return errors.validation('Choose a curriculum and a term.');

    // A scheme of work is a term-by-term spread of someone else's curriculum —
    // generating one is a form of editing that curriculum, so the same rule
    // applies: your own, or a class and subject you are actually assigned to.
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);

    // The class comes from the curriculum. A scheme for a class the plan was
    // not written for is the bug this replaced.
    const schoolClass = db.classes.find((entry) => entry.id === curriculum.classId);
    if (!schoolClass) return errors.notFound('Class');
    if (body.classId && body.classId !== schoolClass.id) {
      return errors.validation(
        `That curriculum is written for ${schoolClass.name}. Pick the curriculum for the class you mean.`,
      );
    }

    // A plan written for one session cannot be spread across another session's
    // weeks — the dates would not even be in the right year.
    if (term.sessionId !== curriculum.sessionId) {
      return errors.validation(
        `That curriculum belongs to ${curriculum.sessionName}. Choose a term in that session.`,
      );
    }

    // Objectives are spread across the term's actual teaching weeks rather than
    // an assumed 12 (research feature 6).
    const topics = db.topics.filter((topic) => topic.curriculumId === curriculum.id);
    const weeks = term.teachingWeeks;
    const objectives = topics.flatMap((topic) =>
      topic.objectives.map((objective) => ({ topic, objective })),
    );
    const perWeek = Math.max(1, Math.ceil(objectives.length / (weeks - 1)));

    const scheme = {
      id: nextId('sow'),
      schoolId: context.schoolId,
      subjectId: curriculum.subjectId,
      subjectName: curriculum.subjectName,
      classId: schoolClass.id,
      className: schoolClass.name,
      termId: term.id,
      termName: term.name,
      sessionName: term.sessionName,
      curriculumId: curriculum.id,
      status: 'DRAFT' as const,
      createdById: context.user.id,
      createdByName: context.user.displayName,
      approvedByName: null,
      approvedAt: null,
      version: 1,
      weeks: Array.from({ length: weeks }, (_, index) => {
        const isBreak = index === Math.floor(weeks / 2);
        const slice = isBreak ? [] : objectives.slice(index * perWeek, (index + 1) * perWeek);
        const start = new Date(term.startDate);
        start.setDate(start.getDate() + index * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 4);

        return {
          id: nextId('swk'),
          weekNumber: index + 1,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          topicId: slice[0]?.topic.id ?? null,
          topicTitle: isBreak ? 'Mid-term break' : (slice[0]?.topic.title ?? 'Revision and assessment'),
          objectiveIds: slice.map((entry) => entry.objective.id),
          objectiveStatements: slice.map((entry) => entry.objective.statement),
          activities: isBreak ? null : 'Draft — adjust to suit your class.',
          resources: null,
          isBreak,
        };
      }),
    };

    db.schemes.unshift(scheme);
    return created(scheme, 'Draft scheme of work generated');
  }),

  http.patch(`${base}/schemes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('scheme.manage')) return errors.forbidden();

    const scheme = scoped(db.schemes, context.schoolId).find((entry) => entry.id === params.id);
    if (!scheme) return errors.notFound('Scheme of work');
    if (!canEditScheme(context, scheme)) return errors.forbidden(SCHEME_NOT_YOURS);

    const ifMatch = request.headers.get('if-match');
    if (ifMatch && Number(ifMatch) !== scheme.version) return errors.versionConflict();

    const body = (await request.json()) as Partial<typeof scheme>;
    if (body.status === 'APPROVED' && !context.can('scheme.approve')) return errors.forbidden();

    Object.assign(scheme, body, { version: scheme.version + 1 });
    if (body.status === 'APPROVED') {
      scheme.approvedByName = context.user.displayName;
      scheme.approvedAt = new Date().toISOString();
    }

    return ok(scheme, 'Scheme of work saved');
  }),
];
