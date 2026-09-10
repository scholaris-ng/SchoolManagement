import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * The filters these three screens send today. Checked even though every list is
 * empty: a filter that was silently ignored for months is a harder bug to find
 * later than one refused from the start.
 */

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

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
