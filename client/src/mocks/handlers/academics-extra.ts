import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
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
import type {
  Curriculum,
  CurriculumCoverage,
  CurriculumTopic,
  LearningObjective,
  TimetableConflict,
  Weekday,
} from '@/types/curriculum';

const base = '/api/v1';
let sequence = 800_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Keeps a curriculum's denormalised topic/objective counts in sync with its topics. */
function recalcCurriculumCounts(curriculumId: string): void {
  const curriculum = db.curricula.find((entry) => entry.id === curriculumId);
  if (!curriculum) return;
  const topics = db.topics.filter((topic) => topic.curriculumId === curriculumId);
  curriculum.topicCount = topics.length;
  curriculum.objectiveCount = topics.reduce((total, topic) => total + topic.objectives.length, 0);
}

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */
export const academicsExtraHandlers = [
  http.get(`${base}/curricula`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.read')) return errors.forbidden();

    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');
    const levelId = url.searchParams.get('levelId');

    return ok(
      scoped(db.curricula, context.schoolId).filter(
        (curriculum) =>
          (!subjectId || curriculum.subjectId === subjectId) &&
          (!levelId || curriculum.levelId === levelId),
      ),
    );
  }),

  http.post(`${base}/curricula`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<Curriculum>;
    if (!body.subjectId || !body.levelId) {
      return errors.validation('A curriculum needs a subject and a level.');
    }
    const subject = db.subjects.find((entry) => entry.id === body.subjectId);
    const level = db.levels.find((entry) => entry.id === body.levelId);
    if (!subject) return errors.notFound('Subject');
    if (!level) return errors.notFound('Level');

    const duplicate = scoped(db.curricula, context.schoolId).some(
      (entry) => entry.subjectId === subject.id && entry.levelId === level.id,
    );
    if (duplicate) {
      return errors.conflict(`A curriculum for ${subject.name} at ${level.name} already exists.`);
    }

    const curriculum: Curriculum = {
      id: nextId('cur'),
      schoolId: context.schoolId,
      name: body.name?.trim() || `${subject.name} — ${level.name}`,
      subjectId: subject.id,
      subjectName: subject.name,
      levelId: level.id,
      levelName: level.name,
      sessionId: null,
      description: body.description?.trim() || null,
      topicCount: 0,
      objectiveCount: 0,
      isActive: true,
    };
    db.curricula.push(curriculum);

    return created(curriculum, 'Curriculum created');
  }),

  http.patch(`${base}/curricula/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');

    const body = (await request.json()) as Partial<Curriculum>;
    const subject = body.subjectId
      ? db.subjects.find((entry) => entry.id === body.subjectId)
      : undefined;
    const level = body.levelId ? db.levels.find((entry) => entry.id === body.levelId) : undefined;
    if (body.subjectId && !subject) return errors.notFound('Subject');
    if (body.levelId && !level) return errors.notFound('Level');

    Object.assign(curriculum, body, {
      name: body.name?.trim() || curriculum.name,
      description:
        body.description !== undefined ? body.description?.trim() || null : curriculum.description,
      subjectName: subject?.name ?? curriculum.subjectName,
      levelName: level?.name ?? curriculum.levelName,
    });

    return ok(curriculum, 'Curriculum updated');
  }),

  http.delete(`${base}/curricula/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');

    const hasSchemes = db.schemes.some((scheme) => scheme.curriculumId === curriculum.id);
    if (hasSchemes) {
      return errors.conflict(
        'This curriculum has schemes of work built from it. Remove them first.',
      );
    }

    db.topics = db.topics.filter((topic) => topic.curriculumId !== curriculum.id);
    db.curricula = db.curricula.filter((entry) => entry.id !== curriculum.id);

    return noContent();
  }),

  http.get(`${base}/curricula/:id/topics`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.read')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');

    return ok(db.topics.filter((topic) => topic.curriculumId === curriculum.id));
  }),

  http.post(`${base}/curricula/:id/topics`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');

    const body = (await request.json()) as Partial<CurriculumTopic>;
    if (!body.title?.trim()) return errors.validation('A topic needs a title.');

    const existingTopics = db.topics.filter((topic) => topic.curriculumId === curriculum.id);
    const topic: CurriculumTopic = {
      id: nextId('top'),
      curriculumId: curriculum.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      sequence: body.sequence ?? existingTopics.length + 1,
      suggestedWeeks: body.suggestedWeeks ?? 1,
      objectives: [],
    };
    db.topics.push(topic);
    recalcCurriculumCounts(curriculum.id);

    return created(topic, 'Topic added');
  }),

  http.patch(`${base}/curricula/:id/topics/:topicId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');
    const topic = db.topics.find(
      (entry) => entry.id === params.topicId && entry.curriculumId === curriculum.id,
    );
    if (!topic) return errors.notFound('Topic');

    const body = (await request.json()) as Partial<CurriculumTopic>;
    Object.assign(topic, body, {
      title: body.title?.trim() || topic.title,
      description: body.description !== undefined ? body.description?.trim() || null : topic.description,
    });

    return ok(topic, 'Topic updated');
  }),

  http.delete(`${base}/curricula/:id/topics/:topicId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');
    const topic = db.topics.find(
      (entry) => entry.id === params.topicId && entry.curriculumId === curriculum.id,
    );
    if (!topic) return errors.notFound('Topic');

    db.topics = db.topics.filter((entry) => entry.id !== topic.id);
    recalcCurriculumCounts(curriculum.id);

    return noContent();
  }),

  http.post(`${base}/curricula/:id/topics/:topicId/objectives`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const curriculum = scoped(db.curricula, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!curriculum) return errors.notFound('Curriculum');
    const topic = db.topics.find(
      (entry) => entry.id === params.topicId && entry.curriculumId === curriculum.id,
    );
    if (!topic) return errors.notFound('Topic');

    const body = (await request.json()) as Partial<LearningObjective>;
    if (!body.statement?.trim()) return errors.validation('An objective needs a statement.');

    const subject = db.subjects.find((entry) => entry.id === curriculum.subjectId);
    const sequence = body.sequence ?? topic.objectives.length + 1;

    const objective: LearningObjective = {
      id: nextId('obj'),
      topicId: topic.id,
      code: `${subject?.code ?? 'GEN'}.${topic.sequence}.${sequence}`,
      statement: body.statement.trim(),
      sequence,
      bloomLevel: body.bloomLevel ?? null,
      taught: false,
      assessed: false,
      taughtOn: null,
      questionCount: 0,
    };
    topic.objectives.push(objective);
    recalcCurriculumCounts(curriculum.id);

    return created(objective, 'Objective added');
  }),

  http.patch(
    `${base}/curricula/:id/topics/:topicId/objectives/:objectiveId`,
    async ({ request, params }) => {
      await delay(latency());
      const context = resolveContext(request);
      if (!context) return errors.unauthenticated();
      if (!context.can('curriculum.manage')) return errors.forbidden();

      const curriculum = scoped(db.curricula, context.schoolId).find(
        (entry) => entry.id === params.id,
      );
      if (!curriculum) return errors.notFound('Curriculum');
      const topic = db.topics.find(
        (entry) => entry.id === params.topicId && entry.curriculumId === curriculum.id,
      );
      if (!topic) return errors.notFound('Topic');
      const objective = topic.objectives.find((entry) => entry.id === params.objectiveId);
      if (!objective) return errors.notFound('Objective');

      // Coverage flags (taught/assessed) are only ever changed through the
      // dedicated coverage endpoint, never here — editing an objective's
      // statement must never silently reset what has already been recorded.
      const body = (await request.json()) as Partial<LearningObjective>;
      Object.assign(objective, {
        statement: body.statement?.trim() || objective.statement,
        bloomLevel: body.bloomLevel !== undefined ? body.bloomLevel : objective.bloomLevel,
        sequence: body.sequence ?? objective.sequence,
      });

      return ok(objective, 'Objective updated');
    },
  ),

  http.delete(
    `${base}/curricula/:id/topics/:topicId/objectives/:objectiveId`,
    async ({ request, params }) => {
      await delay(latency());
      const context = resolveContext(request);
      if (!context) return errors.unauthenticated();
      if (!context.can('curriculum.manage')) return errors.forbidden();

      const curriculum = scoped(db.curricula, context.schoolId).find(
        (entry) => entry.id === params.id,
      );
      if (!curriculum) return errors.notFound('Curriculum');
      const topic = db.topics.find(
        (entry) => entry.id === params.topicId && entry.curriculumId === curriculum.id,
      );
      if (!topic) return errors.notFound('Topic');

      const exists = topic.objectives.some((entry) => entry.id === params.objectiveId);
      if (!exists) return errors.notFound('Objective');

      topic.objectives = topic.objectives.filter((entry) => entry.id !== params.objectiveId);
      recalcCurriculumCounts(curriculum.id);

      return noContent();
    },
  ),

  http.post(`${base}/curricula/:id/coverage`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      objectiveIds: string[];
      taught?: boolean;
      assessed?: boolean;
    };
    const topics = db.topics.filter((topic) => topic.curriculumId === params.id);

    topics.forEach((topic) => {
      topic.objectives.forEach((objective) => {
        if (!body.objectiveIds.includes(objective.id)) return;

        if (body.taught !== undefined) {
          objective.taught = body.taught;
          objective.taughtOn = body.taught ? new Date().toISOString().slice(0, 10) : null;
          // An objective that stops being taught cannot stay assessed — that
          // is exactly the gap the coverage stats exist to surface, so it
          // cannot be left in a state the stats treat as impossible.
          if (!body.taught) objective.assessed = false;
        }

        if (body.assessed !== undefined) {
          objective.assessed = body.assessed && objective.taught;
        }
      });
    });

    return ok({ updated: body.objectiveIds.length }, 'Coverage updated');
  }),

  http.get(`${base}/curriculum-coverage`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.read')) return errors.forbidden();

    const url = new URL(request.url);
    const curriculumId = url.searchParams.get('curriculumId');
    const classId = url.searchParams.get('classId');

    const curriculum = curriculumId
      ? db.curricula.find((entry) => entry.id === curriculumId)
      : scoped(db.curricula, context.schoolId)[0];
    if (!curriculum) return errors.notFound('Curriculum');

    const topics = db.topics.filter((topic) => topic.curriculumId === curriculum.id);
    const cells = topics.flatMap((topic) =>
      topic.objectives.map((objective) => ({
        topicId: topic.id,
        topicTitle: topic.title,
        objectiveId: objective.id,
        objectiveCode: objective.code,
        statement: objective.statement,
        taught: objective.taught,
        assessed: objective.assessed,
      })),
    );

    const taughtCount = cells.filter((cell) => cell.taught).length;
    const assessedCount = cells.filter((cell) => cell.assessed).length;
    const schoolClass = classId ? db.classes.find((entry) => entry.id === classId) : null;
    const currentTerm = scoped(db.terms, context.schoolId).find((term) => term.isCurrent);

    const coverage: CurriculumCoverage = {
      curriculumId: curriculum.id,
      subjectName: curriculum.subjectName,
      className: schoolClass?.name ?? 'All classes',
      termName: currentTerm?.name ?? '',
      totalObjectives: cells.length,
      taughtCount,
      assessedCount,
      taughtNotAssessed: cells.filter((cell) => cell.taught && !cell.assessed).length,
      neverTaught: cells.filter((cell) => !cell.taught).length,
      coverageRate: cells.length ? Math.round((taughtCount / cells.length) * 1000) / 10 : 0,
      assessmentRate: taughtCount ? Math.round((assessedCount / taughtCount) * 1000) / 10 : 0,
      cells,
    };

    return ok(coverage);
  }),

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

    const rows = scoped(db.schemes, context.schoolId)
      .filter(
        (scheme) =>
          (!classId || scheme.classId === classId) &&
          (!subjectId || scheme.subjectId === subjectId) &&
          (!status || scheme.status === status),
      )
      .map(({ weeks: _weeks, ...rest }) => ({ ...rest, weeks: [], weekCount: _weeks.length }));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/schemes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const scheme = scoped(db.schemes, context.schoolId).find((entry) => entry.id === params.id);
    return scheme ? ok(scheme) : errors.notFound('Scheme of work');
  }),

  http.post(`${base}/schemes/generate`, async ({ request }) => {
    await delay(latency() * 2);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('scheme.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      curriculumId: string;
      classId: string;
      termId: string;
    };

    const curriculum = db.curricula.find((entry) => entry.id === body.curriculumId);
    const schoolClass = db.classes.find((entry) => entry.id === body.classId);
    const term = db.terms.find((entry) => entry.id === body.termId);
    if (!curriculum || !schoolClass || !term) {
      return errors.validation('Choose a curriculum, class and term.');
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

    const rows = scoped(db.lessonNotes, context.schoolId)
      .filter(
        (note) =>
          (!status || note.status === status) &&
          (!classId || note.classId === classId) &&
          (!subjectId || note.subjectId === subjectId) &&
          matchesSearch([note.topic, note.teacherName, note.className, note.subjectName], search),
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/lesson-notes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const note = scoped(db.lessonNotes, context.schoolId).find((entry) => entry.id === params.id);
    return note ? ok(note) : errors.notFound('Lesson note');
  }),

  http.post(`${base}/lesson-notes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('lessonnote.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | number | string[]>;
    const schoolClass = db.classes.find((entry) => entry.id === body.classId);
    const subject = db.subjects.find((entry) => entry.id === body.subjectId);
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);

    const note = {
      id: nextId('lsn'),
      schoolId: context.schoolId,
      teacherId: context.membership.staffId ?? 'staff_unknown',
      teacherName: context.user.displayName,
      classId: String(body.classId),
      className: schoolClass?.name ?? '',
      subjectId: String(body.subjectId),
      subjectName: subject?.name ?? '',
      termId: term?.id ?? '',
      weekNumber: Number(body.weekNumber),
      date: String(body.date),
      topic: String(body.topic),
      objectiveIds: (body.objectiveIds as string[]) ?? [],
      objectiveStatements: [],
      content: String(body.content),
      resources: (body.resources as string) || null,
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

    Object.assign(note, body, { version: note.version + 1 });
    if (body.status === 'APPROVED' || body.status === 'RETURNED') {
      note.reviewerName = context.user.displayName;
      note.reviewedAt = new Date().toISOString();
    }

    return ok(note, 'Lesson note updated');
  }),

  /* ---------------------------------------------------------------------- */
  /* Timetable                                                               */
  /* ---------------------------------------------------------------------- */

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

    return ok({
      ...timetable,
      entries: timetable.entries.filter(
        (entry) =>
          (!classId || entry.classId === classId) &&
          (!teacherId || entry.teacherId === teacherId) &&
          (!subjectId || entry.subjectId === subjectId),
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

  /* ---------------------------------------------------------------------- */
  /* Calendar                                                                */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/calendar`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('calendar.read')) return errors.forbidden();

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const category = url.searchParams.get('category');

    return ok(
      scoped(db.calendarEvents, context.schoolId).filter(
        (event) =>
          (!category || event.category === category) &&
          (!from || event.endDate >= from) &&
          (!to || event.startDate <= to),
      ),
    );
  }),

  http.post(`${base}/calendar`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('calendar.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | string[] | boolean>;

    // Warn about a clash rather than refusing it — two events on one day is
    // sometimes intentional, but it should never be accidental.
    const clashes = scoped(db.calendarEvents, context.schoolId).filter(
      (event) =>
        event.startDate <= String(body.endDate) &&
        event.endDate >= String(body.startDate) &&
        (event.audience === body.audience || event.audience === 'EVERYONE'),
    );

    const event = {
      id: nextId('cal'),
      schoolId: context.schoolId,
      title: String(body.title),
      description: (body.description as string) || null,
      category: body.category as never,
      startDate: String(body.startDate),
      endDate: String(body.endDate),
      allDay: Boolean(body.allDay),
      location: (body.location as string) || null,
      audience: body.audience as never,
      classIds: (body.classIds as string[]) ?? [],
      roleNames: (body.roleNames as string[]) ?? [],
      color: null,
      createdByName: context.user.displayName,
    };

    db.calendarEvents.push(event);

    return created(
      { event, conflicts: clashes.map((clash) => ({ eventId: clash.id, title: clash.title, overlapStart: clash.startDate, overlapEnd: clash.endDate, reason: 'Same audience and overlapping dates' })) },
      clashes.length > 0
        ? `Event created — note ${clashes.length} other event${clashes.length === 1 ? '' : 's'} on those dates`
        : 'Event created',
    );
  }),

  /* ---------------------------------------------------------------------- */
  /* CBT                                                                     */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/questions`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('question.manage')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const subjectId = url.searchParams.get('subjectId');
    const difficulty = url.searchParams.get('difficulty');
    const type = url.searchParams.get('type');

    const rows = scoped(db.questions, context.schoolId).filter(
      (question) =>
        (!subjectId || question.subjectId === subjectId) &&
        (!difficulty || question.difficulty === difficulty) &&
        (!type || question.type === type) &&
        matchesSearch([question.text, question.topicTitle, question.subjectName], search),
    );

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/assessments`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const mode = url.searchParams.get('mode');
    const state = url.searchParams.get('state');

    let rows = scoped(db.assessments, context.schoolId).filter(
      (assessment) => (!mode || assessment.mode === mode) && (!state || assessment.state === state),
    );

    // A student only ever sees assessments that are actually open to them.
    if (context.membership.studentId) {
      const student = db.students.find((entry) => entry.id === context.membership.studentId);
      rows = rows.filter(
        (assessment) =>
          assessment.state === 'OPEN' &&
          (assessment.classIds.length === 0 ||
            assessment.classIds.includes(student?.currentClassId ?? '')),
      );
    }

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/assessments/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const assessment = scoped(db.assessments, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    return assessment ? ok(assessment) : errors.notFound('Assessment');
  }),

  http.post(`${base}/assessments/:id/attempts`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('cbt.take')) return errors.forbidden();

    const assessment = scoped(db.assessments, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!assessment) return errors.notFound('Assessment');
    if (assessment.state !== 'OPEN') {
      return errors.conflict('That assessment is not open at the moment.');
    }

    const questions = assessment.questionIds
      .map((questionId) => db.questions.find((entry) => entry.id === questionId))
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
      // Correct answers are stripped from an in-progress attempt.
      .map((question) => ({
        id: question.id,
        type: question.type,
        text: question.text,
        imageUrl: question.imageUrl,
        marks: question.marks,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          text: option.text,
        })),
      }));

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60_000);

    return created({
      id: nextId('atp'),
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      studentId: context.membership.studentId ?? '',
      studentName: context.user.displayName,
      mode: assessment.mode,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      submittedAt: null,
      durationMinutes: assessment.durationMinutes,
      answers: [],
      questions: assessment.shuffleQuestions
        ? [...questions].sort(() => Math.random() - 0.5)
        : questions,
      score: null,
      totalMarks: assessment.totalMarks,
      passed: null,
      status: 'IN_PROGRESS',
    });
  }),

  http.post(`${base}/attempts/:id/answers`, async ({ request }) => {
    // Answers are flushed continuously so a dropped connection mid-exam costs
    // at most the last few seconds of work (spec section 18).
    await delay(60);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const body = (await request.json()) as { answers: { questionId: string; answer: string }[] };
    return ok({ saved: body.answers.length, savedAt: new Date().toISOString() });
  }),

  http.post(`${base}/attempts/:id/submit`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const body = (await request.json()) as {
      assessmentId: string;
      answers: { questionId: string; answer: string | null }[];
    };

    const questions = body.answers.map((answer) => {
      const question = db.questions.find((entry) => entry.id === answer.questionId);
      const correct = question?.options.find((option) => option.isCorrect);
      return {
        questionId: answer.questionId,
        text: question?.text ?? '',
        yourAnswer: answer.answer,
        correctAnswer: correct?.id ?? null,
        isCorrect: Boolean(answer.answer && correct && answer.answer === correct.id),
        explanation: question?.explanation ?? null,
      };
    });

    const correctCount = questions.filter((entry) => entry.isCorrect).length;
    const assessment = db.assessments.find((entry) => entry.id === body.assessmentId);
    const totalMarks = questions.length;
    const percentage = totalMarks ? Math.round((correctCount / totalMarks) * 1000) / 10 : 0;

    return ok({
      attemptId: String(params.id),
      assessmentTitle: assessment?.title ?? '',
      score: correctCount,
      totalMarks,
      percentage,
      passed: percentage >= (assessment?.passScore ?? 50),
      correctCount,
      wrongCount: questions.filter((entry) => !entry.isCorrect && entry.yourAnswer).length,
      unansweredCount: questions.filter((entry) => !entry.yourAnswer).length,
      submittedAt: new Date().toISOString(),
      // A practice run shows the answers; an exam does not.
      breakdown: assessment?.mode === 'PRACTICE' ? questions : [],
    });
  }),
];
