import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { DIFFICULTIES, QUESTION_TYPES } from '../entities/question.entity';
import { ASSESSMENT_MODES, ASSESSMENT_STATES } from '../entities/cbtAssessment.entity';

/** Mirrors `client/src/features/cbt/cbt.endpoints.ts`. */

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

const option = z
  .object({
    id: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(8),
    text: z.string().trim().min(1).max(2000),
    isCorrect: z.boolean().default(false),
  })
  .strict();

const questionBody = z.object({
  subjectId: z.string().uuid('Choose a subject.'),
  topicId: z.string().uuid().nullish().default(null),
  objectiveId: z.string().uuid().nullish().default(null),
  levelId: z.string().uuid().nullish().default(null),
  type: z.enum(QUESTION_TYPES),
  difficulty: z.enum(DIFFICULTIES).default('MEDIUM'),
  text: z.string().trim().min(1, 'Write the question.').max(5000),
  imageUrl: z.string().trim().url().max(500).nullish().transform((value) => (value ? value : null)),
  options: z.array(option).max(10).default([]),
  correctAnswer: optionalText(1000),
  explanation: optionalText(5000),
  marks: z.coerce.number().int().min(1).max(100).default(1),
});

/**
 * A multiple-choice or true/false question needs options with exactly one
 * marked correct; a short answer needs the answer itself. A question nobody
 * can mark is worse than no question.
 */
function answerable(value: z.infer<typeof questionBody>): boolean {
  if (value.type === 'SHORT_ANSWER') return Boolean(value.correctAnswer);
  return value.options.length >= 2 && value.options.filter((entry) => entry.isCorrect).length === 1;
}

const ANSWERABLE_MESSAGE =
  'A multiple-choice question needs at least two options with exactly one correct; a short answer needs its answer.';

export const fetchQuestionsSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      subjectId: z.string().uuid().optional(),
      topicId: z.string().uuid().optional(),
      objectiveId: z.string().uuid().optional(),
      difficulty: z.enum(DIFFICULTIES).optional(),
      type: z.enum(QUESTION_TYPES).optional(),
    })
    .strict(),
});

export const createQuestionSchema = z.object({
  body: questionBody.strict().refine(answerable, { message: ANSWERABLE_MESSAGE, path: ['options'] }),
});

export const questionParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const updateQuestionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: questionBody.partial().strict(),
});

/* -- Assessments ----------------------------------------------------------- */

const assessmentBody = z.object({
  title: z.string().trim().min(1, 'Give the paper a title.').max(160),
  mode: z.enum(ASSESSMENT_MODES).default('PRACTICE'),
  subjectId: z.string().uuid('Choose a subject.'),
  classIds: z.array(z.string().uuid()).min(1, 'Choose at least one class.').max(50),
  termId: z.string().uuid('Choose a term.'),
  questionIds: z.array(z.string().uuid()).min(1, 'A paper needs at least one question.').max(200),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(30),
  attemptsAllowed: z.coerce.number().int().min(1).max(20).default(1),
  startsAt: z.coerce.date().nullish().default(null),
  endsAt: z.coerce.date().nullish().default(null),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  showResultImmediately: z.boolean().default(true),
  passScore: z.coerce.number().int().min(0).max(100).default(50),
  state: z.enum(ASSESSMENT_STATES).optional(),
});

export const fetchAssessmentsSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      subjectId: z.string().uuid().optional(),
      mode: z.enum(ASSESSMENT_MODES).optional(),
      state: z.enum(ASSESSMENT_STATES).optional(),
    })
    .strict(),
});

export const createAssessmentSchema = z.object({
  body: assessmentBody.strict().refine((value) => !value.endsAt || !value.startsAt || value.endsAt > value.startsAt, {
    message: 'A paper cannot close before it opens.',
    path: ['endsAt'],
  }),
});

export const assessmentParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const updateAssessmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: assessmentBody.partial().strict(),
});

/* -- Attempts -------------------------------------------------------------- */

export const attemptParamSchema = z.object({ params: z.object({ attemptId: z.string().uuid() }) });

export const flushAnswersSchema = z.object({
  params: z.object({ attemptId: z.string().uuid() }),
  body: z
    .object({
      answers: z
        .array(z.object({ questionId: z.string().uuid(), answer: z.string().max(5000) }).strict())
        .max(200),
    })
    .strict(),
});

export const submitAttemptSchema = z.object({
  params: z.object({ attemptId: z.string().uuid() }),
  body: z
    .object({
      assessmentId: z.string().uuid(),
      answers: z
        .array(z.object({ questionId: z.string().uuid(), answer: z.string().max(5000).nullable() }).strict())
        .max(200)
        .default([]),
    })
    .strict(),
});

export type FetchQuestionsQuery = z.infer<typeof fetchQuestionsSchema>['query'];
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>['body'];
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>['body'];
export type FetchAssessmentsQuery = z.infer<typeof fetchAssessmentsSchema>['query'];
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>['body'];
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>['body'];
export type FlushAnswersInput = z.infer<typeof flushAnswersSchema>['body'];
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>['body'];

export { answerable, ANSWERABLE_MESSAGE };
