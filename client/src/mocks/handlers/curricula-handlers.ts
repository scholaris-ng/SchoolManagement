import { http, delay } from 'msw';
import {
  academicScope,
  currentSession,
  db,
  resolveContext,
  scopeAllows,
  scoped,
} from '../context';
import {
  created,
  errors,
  latency,
  noContent,
  ok,
} from '../http-helpers';
import type {
  Curriculum,
  CurriculumCoverage,
  CurriculumTopic,
  LearningObjective,
} from '@/types/curriculum';
import {
  base,
  nextId,
  recalcCurriculumCounts,
  roleLabel,
  canEditCurriculum,
  NOT_YOURS,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** Routes for this module. */

/** Routes for this module. */
export const curriculaHandlers = [
  http.get(`${base}/curricula`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.read')) return errors.forbidden();

    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');
    const levelId = url.searchParams.get('levelId');
    const classId = url.searchParams.get('classId');
    const createdById = url.searchParams.get('createdById');

    // Session defaults to whichever one the school is currently in, so every
    // caller follows the switch an administrator throws without having to know
    // it exists. `sessionId=ALL` is the deliberate opt-out for looking back.
    const requestedSession = url.searchParams.get('sessionId');
    const sessionId =
      requestedSession === 'ALL'
        ? null
        : (requestedSession ?? currentSession(context.schoolId)?.id ?? null);

    // A teacher's list is the curricula for the classes and subjects they
    // teach; everyone else's remit decides the rest.
    const scope = academicScope(context);

    return ok(
      scoped(db.curricula, context.schoolId).filter(
        (curriculum) =>
          (!subjectId || curriculum.subjectId === subjectId) &&
          (!levelId || curriculum.levelId === levelId) &&
          (!classId || curriculum.classId === classId) &&
          (!sessionId || curriculum.sessionId === sessionId) &&
          (!createdById || curriculum.createdById === createdById) &&
          (curriculum.createdById === context.user.id ||
            scopeAllows(scope, {
              classId: curriculum.classId,
              subjectId: curriculum.subjectId,
            })),
      ),
    );
  }),

  http.post(`${base}/curricula`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('curriculum.manage')) return errors.forbidden();

    const body = (await request.json()) as Partial<Curriculum>;
    if (!body.subjectId || !body.classId) {
      return errors.validation('A curriculum needs a subject and a class.');
    }
    const subject = scoped(db.subjects, context.schoolId).find(
      (entry) => entry.id === body.subjectId,
    );
    const schoolClass = scoped(db.classes, context.schoolId).find(
      (entry) => entry.id === body.classId,
    );
    if (!subject) return errors.notFound('Subject');
    if (!schoolClass) return errors.notFound('Class');

    // The level is the class's level, never a separate answer that could
    // disagree with it.
    const level = db.levels.find((entry) => entry.id === schoolClass.levelId);
    if (!level) return errors.notFound('Level');

    // A teacher may only write for what they teach. Admins and principals hold
    // `academics.manage` and so are unrestricted here.
    if (!scopeAllows(academicScope(context), { classId: schoolClass.id, subjectId: subject.id })) {
      return errors.forbidden(
        `You are not assigned to teach ${subject.name} in ${schoolClass.name}.`,
      );
    }

    // A new curriculum belongs to the session the school is working in. Last
    // year's plan for the same class is left alone rather than blocking this
    // year's, which is why the session is part of the uniqueness rule.
    const session = currentSession(context.schoolId);
    if (!session) {
      return errors.validation(
        'Set up an academic session, and make one of its terms current, before writing a curriculum.',
      );
    }

    const duplicate = scoped(db.curricula, context.schoolId).some(
      (entry) =>
        entry.subjectId === subject.id &&
        entry.classId === schoolClass.id &&
        entry.sessionId === session.id,
    );
    if (duplicate) {
      return errors.conflict(
        `A ${subject.name} curriculum for ${schoolClass.name} already exists in ${session.name}.`,
      );
    }

    const now = new Date().toISOString();
    const curriculum: Curriculum = {
      id: nextId('cur'),
      schoolId: context.schoolId,
      name: body.name?.trim() || `${subject.name} — ${schoolClass.name}`,
      subjectId: subject.id,
      subjectName: subject.name,
      classId: schoolClass.id,
      className: schoolClass.name,
      levelId: level.id,
      levelName: level.name,
      sessionId: session.id,
      sessionName: session.name,
      description: body.description?.trim() || null,
      topicCount: 0,
      objectiveCount: 0,
      isActive: true,
      createdById: context.user.id,
      createdByName: context.user.displayName,
      createdByRole: roleLabel(context),
      createdAt: now,
      updatedAt: now,
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
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);

    const body = (await request.json()) as Partial<Curriculum>;
    const subject = body.subjectId
      ? scoped(db.subjects, context.schoolId).find((entry) => entry.id === body.subjectId)
      : undefined;
    const schoolClass = body.classId
      ? scoped(db.classes, context.schoolId).find((entry) => entry.id === body.classId)
      : undefined;
    if (body.subjectId && !subject) return errors.notFound('Subject');
    if (body.classId && !schoolClass) return errors.notFound('Class');

    const nextSubjectId = subject?.id ?? curriculum.subjectId;
    const nextClassId = schoolClass?.id ?? curriculum.classId;

    if (
      (subject || schoolClass) &&
      !scopeAllows(academicScope(context), { classId: nextClassId, subjectId: nextSubjectId })
    ) {
      return errors.forbidden('You are not assigned to teach that subject in that class.');
    }

    const duplicate = scoped(db.curricula, context.schoolId).some(
      (entry) =>
        entry.id !== curriculum.id &&
        entry.subjectId === nextSubjectId &&
        entry.classId === nextClassId &&
        entry.sessionId === curriculum.sessionId,
    );
    if (duplicate) {
      return errors.conflict(
        `A curriculum for that subject and class already exists in ${curriculum.sessionName}.`,
      );
    }

    // The level always follows the class, so it is recomputed rather than
    // taken from the request.
    const level = schoolClass
      ? db.levels.find((entry) => entry.id === schoolClass.levelId)
      : undefined;

    Object.assign(curriculum, body, {
      name: body.name?.trim() || curriculum.name,
      description:
        body.description !== undefined ? body.description?.trim() || null : curriculum.description,
      subjectId: nextSubjectId,
      subjectName: subject?.name ?? curriculum.subjectName,
      classId: nextClassId,
      className: schoolClass?.name ?? curriculum.className,
      levelId: level?.id ?? curriculum.levelId,
      levelName: level?.name ?? curriculum.levelName,
      // The session a plan was written for is fixed. Next year's plan is a new
      // curriculum, not this one relabelled, or its coverage history would be
      // silently reassigned to a year it does not describe.
      sessionId: curriculum.sessionId,
      sessionName: curriculum.sessionName,
      // Authorship is a fact about the past; a later editor never overwrites it.
      createdById: curriculum.createdById,
      createdByName: curriculum.createdByName,
      createdByRole: curriculum.createdByRole,
      createdAt: curriculum.createdAt,
      updatedAt: new Date().toISOString(),
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
    // Deleting is stricter than editing: only the author or a coordinator.
    if (!context.can('academics.manage') && curriculum.createdById !== context.user.id) {
      return errors.forbidden(
        'Only the teacher who wrote this curriculum, or a coordinator, can delete it.',
      );
    }

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
    // The list already hides curricula outside a teacher's classes and
    // subjects; the detail view — the actual topics and objectives — must
    // refuse the same way for a link followed straight to it, or the list's
    // filtering is theatre.
    if (!canEditCurriculum(context, curriculum)) return errors.notFound('Curriculum');

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
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);

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
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);
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
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);
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
    if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);
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
      if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);
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
      if (!canEditCurriculum(context, curriculum)) return errors.forbidden(NOT_YOURS);
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

    const target = scoped(db.curricula, context.schoolId).find((entry) => entry.id === params.id);
    if (!target) return errors.notFound('Curriculum');
    if (!canEditCurriculum(context, target)) return errors.forbidden(NOT_YOURS);

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

    const curriculum = curriculumId
      ? scoped(db.curricula, context.schoolId).find((entry) => entry.id === curriculumId)
      : scoped(db.curricula, context.schoolId)[0];
    if (!curriculum) return errors.notFound('Curriculum');
    if (
      curriculum.createdById !== context.user.id &&
      !scopeAllows(academicScope(context), {
        classId: curriculum.classId,
        subjectId: curriculum.subjectId,
      })
    ) {
      return errors.notFound('Curriculum');
    }

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
    // The term reported is the current one when it falls inside this plan's
    // session, and otherwise the plan's own last term — a 2024/2025 curriculum
    // must not be labelled with a 2025/2026 term.
    const terms = scoped(db.terms, context.schoolId);
    const current = terms.find((term) => term.isCurrent);
    const termName =
      current?.sessionId === curriculum.sessionId
        ? current.name
        : (terms
            .filter((term) => term.sessionId === curriculum.sessionId)
            .sort((a, b) => b.sequence - a.sequence)[0]?.name ?? '');

    const coverage: CurriculumCoverage = {
      curriculumId: curriculum.id,
      subjectName: curriculum.subjectName,
      // The curriculum names its own class, so coverage can no longer be read
      // against a class the plan was never written for.
      className: curriculum.className,
      termName,
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
];
