import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { TRAIT_CATEGORIES } from '../entities/behaviourTrait.entity';
import { HOUSE_POINT_REASONS } from '../entities/housePointAward.entity';

/** Mirrors `client/src/features/behaviour/behaviour.endpoints.ts`. */

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

const traitBody = z.object({
  name: z.string().trim().min(1, 'Name the trait.').max(120),
  category: z.enum(TRAIT_CATEGORIES),
  description: optionalText(1000),
  scaleId: z.string().uuid('Choose a scale.'),
  levelIds: z.array(z.string().uuid()).max(50).optional(),
  appearsOnReportCard: z.boolean().default(true),
  sequence: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
});

export const createTraitSchema = z.object({ body: traitBody.strict() });

export const updateTraitSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: traitBody.partial().strict(),
});

export const fetchObservationsSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      traitId: z.string().uuid().optional(),
      classId: z.string().uuid().optional(),
      studentId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
    })
    .strict(),
});

export const recordObservationSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose a pupil.'),
      traitId: z.string().uuid('Choose a trait.'),
      rating: z.coerce.number().int(),
      note: optionalText(1000),
    })
    .strict(),
});

export const fetchHousePointsSchema = z.object({
  query: z
    .object({
      page,
      pageSize,
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      studentId: z.string().uuid().optional(),
      houseId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
    })
    .strict(),
});

/** Negative points are a penalty; zero is not an award. */
export const awardHousePointsSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose a pupil.'),
      points: z.coerce
        .number()
        .int()
        .min(-100)
        .max(100)
        .refine((value) => value !== 0, 'Award or deduct at least one point.'),
      reason: z.enum(HOUSE_POINT_REASONS),
      note: optionalText(1000),
    })
    .strict(),
});

export const fetchLeaderboardSchema = z.object({
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export const studentBehaviourSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

export type CreateTraitInput = z.infer<typeof createTraitSchema>['body'];
export type UpdateTraitInput = z.infer<typeof updateTraitSchema>['body'];
export type FetchObservationsQuery = z.infer<typeof fetchObservationsSchema>['query'];
export type RecordObservationInput = z.infer<typeof recordObservationSchema>['body'];
export type FetchHousePointsQuery = z.infer<typeof fetchHousePointsSchema>['query'];
export type AwardHousePointsInput = z.infer<typeof awardHousePointsSchema>['body'];
