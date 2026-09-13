import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { COMPONENT_TYPES } from '../entities/gradingScheme.entity';
import { RESULT_STATUSES } from '../entities/scoreSheet.entity';
import { COMMENT_AUDIENCES, COMMENT_BANDS } from '../entities/reportCard.entity';

/** Mirrors `client/src/features/results/results.endpoints.ts`. */

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

/* -- Grading schemes ------------------------------------------------------- */

const component = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80),
    code: z.string().trim().min(1).max(20),
    maxScore: z.coerce.number().int().min(1).max(1000),
    sequence: z.coerce.number().int().min(1),
    type: z.enum(COMPONENT_TYPES).default('CONTINUOUS_ASSESSMENT'),
  })
  .passthrough();

const band = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(8),
    minScore: z.coerce.number().int().min(0).max(100),
    maxScore: z.coerce.number().int().min(0).max(100),
    remark: z.string().trim().min(1).max(80),
    gradePoint: z.coerce.number().min(0).max(10).nullish().default(null),
    isPass: z.boolean().default(true),
    color: z.string().trim().max(20).nullish().default(null),
  })
  .passthrough()
  .refine((value) => value.maxScore >= value.minScore, { message: 'A band cannot end before it starts.', path: ['maxScore'] });

/**
 * The bands must tile 0–100 with no gaps and no overlaps, or some total would
 * have no grade. Checked here and again on the client.
 */
function bandsTile(bands: { minScore: number; maxScore: number }[]): boolean {
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  if (sorted.length === 0 || sorted[0].minScore !== 0) return false;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].minScore !== sorted[i - 1].maxScore + 1) return false;
  }
  return sorted[sorted.length - 1].maxScore === 100;
}

const schemeBody = z.object({
  name: z.string().trim().min(1, 'Name the scheme.').max(120),
  description: optionalText(1000),
  isDefault: z.boolean().optional(),
  passMark: z.coerce.number().int().min(0).max(100).optional(),
  levelIds: z.array(z.string().uuid()).max(50).optional(),
  showPosition: z.boolean().optional(),
  components: z.array(component).min(1, 'A scheme needs at least one component.').max(20),
  bands: z.array(band).min(1, 'A scheme needs at least one grade band.').max(20).refine(bandsTile, {
    message: 'Grade bands must cover 0 to 100 with no gaps or overlaps.',
  }),
});

/** The client sends the whole scheme back, ids, names and all; the rest is ignored. */
export const createGradingSchemeSchema = z.object({ body: schemeBody.passthrough() });

export const updateGradingSchemeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: schemeBody.partial().passthrough(),
});

/* -- Score sheets ---------------------------------------------------------- */

export const fetchScoreSheetsSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      classId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
      status: z.enum(RESULT_STATUSES).optional(),
    })
    .strict(),
});

export const scoreSheetParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const saveScoresSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      entries: z
        .array(
          z
            .object({
              studentId: z.string().uuid(),
              componentId: z.string().uuid(),
              score: z.coerce.number().min(0).max(1000).nullable(),
            })
            .strict(),
        )
        .min(1)
        .max(5000),
    })
    .strict(),
});

export const transitionScoreSheetSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      to: z.enum(RESULT_STATUSES),
      note: optionalText(1000),
    })
    .strict(),
});

/* -- Report cards, broadsheet, comments ------------------------------------ */

export const reportCardParamSchema = z.object({
  params: z.object({ studentId: z.string().uuid(), termId: z.string().uuid() }),
});

export const saveReportCardCommentsSchema = z.object({
  params: z.object({ studentId: z.string().uuid(), termId: z.string().uuid() }),
  body: z
    .object({
      formTeacherComment: optionalText(2000),
      principalComment: optionalText(2000),
    })
    .strict(),
});

export const studentResultsSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export const broadsheetSchema = z.object({
  query: z.object({ classId: z.string().uuid(), termId: z.string().uuid() }).strict(),
});

export const createCommentTemplateSchema = z.object({
  body: z
    .object({
      audience: z.enum(COMMENT_AUDIENCES),
      band: z.enum(COMMENT_BANDS).default('GENERAL'),
      text: z.string().trim().min(1, 'Write the comment.').max(1000),
    })
    .strict(),
});

/* -- Transcripts and verification ------------------------------------------ */

export const transcriptParamSchema = z.object({ params: z.object({ studentId: z.string().uuid() }) });

export const verifyParamSchema = z.object({
  params: z.object({ code: z.string().trim().min(6).max(24) }),
});

export type CreateGradingSchemeInput = z.infer<typeof createGradingSchemeSchema>['body'];
export type UpdateGradingSchemeInput = z.infer<typeof updateGradingSchemeSchema>['body'];
export type FetchScoreSheetsQuery = z.infer<typeof fetchScoreSheetsSchema>['query'];
export type SaveScoresInput = z.infer<typeof saveScoresSchema>['body'];
export type TransitionScoreSheetInput = z.infer<typeof transitionScoreSheetSchema>['body'];
export type SaveReportCardCommentsInput = z.infer<typeof saveReportCardCommentsSchema>['body'];
export type CreateCommentTemplateInput = z.infer<typeof createCommentTemplateSchema>['body'];
