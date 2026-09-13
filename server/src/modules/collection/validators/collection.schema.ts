import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { AUTHORIZATION_STATUSES } from '../entities/pickupPerson.entity';
import { COLLECTION_METHODS } from '../entities/collectionEvent.entity';

/**
 * Mirrors `client/src/features/collection/collection.endpoints.ts` and the
 * pickup calls in `client/src/features/students/student-history.endpoints.ts`.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const personBody = z.object({
  name: z.string().trim().min(1, 'Name the person.').max(160),
  relationship: z.string().trim().min(1, 'Say how they are related.').max(60),
  phone,
  photoUrl: z.string().trim().url().max(500).nullish().transform((value) => (value ? value : null)),
  authorizationStatus: z.enum(AUTHORIZATION_STATUSES).default('PENDING'),
  note: optionalText(1000),
});

export const studentPickupParamSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
});

export const createPickupPersonSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  body: personBody.strict(),
});

export const updatePickupPersonSchema = z.object({
  params: z.object({ studentId: z.string().uuid(), id: z.string().uuid() }),
  body: personBody.partial().strict(),
});

export const fetchCollectionEventsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().trim().max(120).optional(),
      sortBy: z.string().trim().max(40).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      studentId: z.string().uuid().optional(),
    })
    .strict(),
});

/**
 * Either a person from the pickup list or a name typed at the gate. When a
 * listed person is named the service takes the name and relationship from the
 * list, so the two cannot disagree about who it was.
 */
export const releaseChildSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose a pupil.'),
      pickupPersonId: z.string().uuid().nullish().default(null),
      pickupPersonName: z.string().trim().max(160).default(''),
      relationship: z.string().trim().max(60).default(''),
      method: z.enum(COLLECTION_METHODS),
      note: optionalText(1000),
    })
    .strict()
    .refine((value) => Boolean(value.pickupPersonId) || value.pickupPersonName.length > 0, {
      message: 'Say who collected the child.',
      path: ['pickupPersonName'],
    }),
});

export type CreatePickupPersonInput = z.infer<typeof createPickupPersonSchema>['body'];
export type UpdatePickupPersonInput = z.infer<typeof updatePickupPersonSchema>['body'];
export type FetchCollectionEventsQuery = z.infer<typeof fetchCollectionEventsSchema>['query'];
export type ReleaseChildInput = z.infer<typeof releaseChildSchema>['body'];
