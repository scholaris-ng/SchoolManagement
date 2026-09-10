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
  ok,
  paginate,
  readListParams,
} from '../http-helpers';
import {
  base,
  nextId,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** CBT. */
export const cbtHandlers = [

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
