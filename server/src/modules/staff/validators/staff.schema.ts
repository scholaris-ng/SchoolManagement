import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ROLES } from '../../../config/constants';

/**
 * Roles a school may hand a staff member through this endpoint. `SUPER_ADMIN`
 * is platform-only, and `PARENT`/`STUDENT` are granted through the guardian
 * and student flows — not by typing a role name into this form.
 */
const ASSIGNABLE_STAFF_ROLES = ROLES.filter(
  (role) => role !== 'SUPER_ADMIN' && role !== 'PARENT' && role !== 'STUDENT',
);

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

/** Mirrors `client/src/features/staff/schema.ts` — the client's copy is a courtesy, this is the authority. */
const staffBody = z.object({
  staffNo: z.string().trim().min(1, 'Staff number is required').max(40),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Surname is required').max(100),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(160)
    .transform((value) => value.toLowerCase()),
  phone,
  gender: z.enum(['MALE', 'FEMALE']),
  designation: z.string().trim().min(1, 'Designation is required').max(120),
  department: optionalText(120),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  employmentDate: isoDate,
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'EXITED']),
  photoUrl: z.string().url().max(500).nullable().optional(),
  photoStoragePath: z.string().max(500).nullable().optional(),
  roleNames: z
    .array(z.enum(ASSIGNABLE_STAFF_ROLES as [string, ...string[]]))
    .min(1, 'Give this member of staff at least one role'),
  subjectIds: z.array(z.string().uuid()).max(200).default([]),
  classIds: z.array(z.string().uuid()).max(200).default([]),
  isFormTeacher: z.boolean().default(false),
});

export const createStaffSchema = z.object({ body: staffBody.strict() });

export const updateStaffSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  // `email` here is the staff directory's contact address, checked for a clash
  // against other staff the same way the rest of these fields are — it is not
  // wired to the linked sign-in credential, which changes through account
  // settings instead.
  body: staffBody.partial().strict(),
});

export const fetchStaffSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    status: z.enum(['ACTIVE', 'ON_LEAVE', 'EXITED']).optional(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).optional(),
    // Free text rather than an enum: departments are whatever a school calls
    // them, and no catalogue of them exists to check against.
    department: z.string().trim().max(120).optional(),
    // Given together, these narrow to the one teaching assignment that pairs
    // them — not to anyone who teaches the class and, separately, teaches the
    // subject somewhere else (see `fetchPaginated`).
    classId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
  }),
});

export const staffIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type FetchStaffQuery = z.infer<typeof fetchStaffSchema>['query'];
export type CreateStaffInput = z.infer<typeof createStaffSchema>['body'];
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>['body'];
