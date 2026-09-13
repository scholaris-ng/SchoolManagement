import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { BLOOM_LEVELS } from '../entities/learningObjective.entity';

/**
 * Mirrors `client/src/features/curriculum/curricula.endpoints.ts` for the
 * curriculum tree, and the scheme and lesson-note list filters those screens
 * send.
 */

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

/** Blank becomes null; absent stays absent, so a patch can leave a field alone. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

/* -- Curricula ------------------------------------------------------------- */

export const fetchCurriculaSchema = z.object({
  query: z
    .object({
      subjectId: z.string().uuid().optional(),
      levelId: z.string().uuid().optional(),
      classId: z.string().uuid().optional(),
      // `ALL` looks across previous years instead of the current session, so
      // this is not a plain uuid field.
      sessionId: z.union([z.literal('ALL'), z.string().uuid()]).optional(),
      createdById: z.string().uuid().optional(),
    })
    .strict(),
});

/**
 * The class and subject are the identity; the level is derived from the class
 * and the session is the school's current one, so neither is accepted. A blank
 * name defaults to "subject — class" in the service.
 */
export const createCurriculumSchema = z.object({
  body: z
    .object({
      classId: z.string().uuid('Select a class.'),
      subjectId: z.string().uuid('Select a subject.'),
      name: z.string().trim().max(160).optional(),
      description: optionalText(2000),
    })
    .strict(),
});

export const curriculumParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateCurriculumSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      classId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
      name: z.string().trim().max(160).optional(),
      description: optionalText(2000),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

/* -- Topics ---------------------------------------------------------------- */

const curriculumScoped = z.object({ curriculumId: z.string().uuid() });

export const curriculumScopedParamSchema = z.object({ params: curriculumScoped });

const topicBody = z.object({
  title: z.string().trim().min(1, 'Give the topic a title.').max(200),
  description: optionalText(2000),
  sequence: z.coerce.number().int().min(1).optional(),
  suggestedWeeks: z.coerce.number().int().min(1).max(52).default(1),
});

export const createTopicSchema = z.object({
  params: curriculumScoped,
  body: topicBody.strict(),
});

export const topicParamSchema = z.object({
  params: curriculumScoped.extend({ topicId: z.string().uuid() }),
});

export const updateTopicSchema = z.object({
  params: curriculumScoped.extend({ topicId: z.string().uuid() }),
  body: topicBody.partial().strict(),
});

/* -- Objectives ------------------------------------------------------------ */

const objectiveBody = z.object({
  statement: z.string().trim().min(1, 'Write the objective.').max(1000),
  bloomLevel: z.enum(BLOOM_LEVELS).nullish().default(null),
  sequence: z.coerce.number().int().min(1).optional(),
});

export const createObjectiveSchema = z.object({
  params: curriculumScoped.extend({ topicId: z.string().uuid() }),
  body: objectiveBody.strict(),
});

export const objectiveParamSchema = z.object({
  params: curriculumScoped.extend({
    topicId: z.string().uuid(),
    objectiveId: z.string().uuid(),
  }),
});

export const updateObjectiveSchema = z.object({
  params: curriculumScoped.extend({
    topicId: z.string().uuid(),
    objectiveId: z.string().uuid(),
  }),
  body: objectiveBody.partial().strict(),
});

/* -- Coverage -------------------------------------------------------------- */

export const fetchCoverageSchema = z.object({
  query: z
    .object({
      curriculumId: z.string().uuid('Name a curriculum.'),
      // Accepted for the client's sake; a curriculum already belongs to one class.
      classId: z.string().uuid().optional(),
    })
    .strict(),
});

/** At least one of the two flags, or there is nothing to mark. */
export const markCoverageSchema = z.object({
  params: curriculumScoped,
  body: z
    .object({
      objectiveIds: z.array(z.string().uuid()).min(1).max(500),
      taught: z.boolean().optional(),
      assessed: z.boolean().optional(),
    })
    .strict()
    .refine((value) => value.taught !== undefined || value.assessed !== undefined, {
      message: 'Say whether the objectives were taught, assessed, or both.',
      path: ['taught'],
    }),
});

/* -- Schemes of work ------------------------------------------------------- */

export const fetchSchemesSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).default('asc'),
      classId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']).optional(),
    })
    .strict(),
});

export const generateSchemeSchema = z.object({
  body: z
    .object({
      curriculumId: z.string().uuid('Choose a curriculum.'),
      classId: z.string().uuid('Choose a class.'),
      termId: z.string().uuid('Choose a term.'),
    })
    .strict(),
});

export const schemeParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const schemeWeekBody = z.object({
  id: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  topicId: z.string().uuid().nullish().default(null),
  topicTitle: z.string().trim().max(200).default(''),
  objectiveIds: z.array(z.string().uuid()).max(200).default([]),
  objectiveStatements: z.array(z.string().trim().max(1000)).max(200).default([]),
  activities: optionalText(4000),
  resources: optionalText(4000),
  isBreak: z.boolean().default(false),
});

/**
 * The weeks come back whole. Status may move forward one step — a draft is
 * submitted, a submission approved — and the service checks who may do which.
 */
export const updateSchemeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      weeks: z.array(schemeWeekBody).max(60).optional(),
      status: z.enum(['SUBMITTED', 'APPROVED']).optional(),
    })
    .strict(),
});

/* -- Lesson notes ---------------------------------------------------------- */

export const fetchLessonNotesSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
      classId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
      // A note can come back to its author for changes, which a scheme cannot.
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED']).optional(),
    })
    .strict(),
});

export const lessonNoteParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.');

const noteBody = z.object({
  schemeId: z.string().uuid('Choose a scheme of work.'),
  schemeWeekId: z.string().uuid('Choose a week.'),
  date: isoDate,
  content: z.string().trim().min(1, 'Write the lesson.').max(50_000),
  assignment: optionalText(10_000),
  challenges: optionalText(10_000),
  studentDifficulties: optionalText(10_000),
});

export const createLessonNoteSchema = z.object({
  body: noteBody
    .extend({ status: z.enum(['DRAFT', 'SUBMITTED']).optional() })
    .strict(),
});

export const updateLessonNoteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: noteBody
    .partial()
    .extend({
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED']).optional(),
      reviewComment: optionalText(4000),
    })
    .strict(),
});

export const bulkDeleteLessonNotesSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).strict(),
});

export type FetchSchemesQuery = z.infer<typeof fetchSchemesSchema>['query'];
export type GenerateSchemeInput = z.infer<typeof generateSchemeSchema>['body'];
export type UpdateSchemeInput = z.infer<typeof updateSchemeSchema>['body'];
export type FetchLessonNotesQuery = z.infer<typeof fetchLessonNotesSchema>['query'];
export type CreateLessonNoteInput = z.infer<typeof createLessonNoteSchema>['body'];
export type UpdateLessonNoteInput = z.infer<typeof updateLessonNoteSchema>['body'];

export type FetchCurriculaQuery = z.infer<typeof fetchCurriculaSchema>['query'];
export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>['body'];
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>['body'];
export type CreateTopicInput = z.infer<typeof createTopicSchema>['body'];
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>['body'];
export type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>['body'];
export type UpdateObjectiveInput = z.infer<typeof updateObjectiveSchema>['body'];
export type FetchCoverageQuery = z.infer<typeof fetchCoverageSchema>['query'];
export type MarkCoverageInput = z.infer<typeof markCoverageSchema>['body'];
