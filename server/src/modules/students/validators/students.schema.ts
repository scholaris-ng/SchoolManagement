import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/** Mirrors `client/src/features/students/schema.ts` — the client's copy is a courtesy, this is the authority. */

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form')
  .refine((value) => new Date(value) < new Date(), 'Date of birth cannot be in the future')
  .refine((value) => {
    const years = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return years < 30;
  }, 'That date of birth looks wrong for a student');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

const studentBody = z.object({
  admissionNo: z
    .string()
    .trim()
    .min(1, 'Admission number is required')
    .max(32)
    .regex(/^[A-Za-z0-9/\-_]+$/, 'Use letters, numbers, hyphens and slashes only'),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  middleName: optionalText(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth,
  admissionDate: isoDate,
  currentClassId: z.string().uuid('Select a class'),
  houseId: z.string().uuid().optional().or(z.literal('')),
  photoUrl: z.string().url().max(500).nullable().optional(),
  photoStoragePath: z.string().max(500).nullable().optional(),
  // Defaults to false. Nothing publishes a child's photograph until somebody
  // has actively said yes (spec section 41).
  photoConsent: z.boolean().default(false),
  bloodGroup: optionalText(8),
  medicalNotes: optionalText(2000),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: phone.optional().or(z.literal('')),
  address: optionalText(300),
  nationality: optionalText(60),
  stateOfOrigin: optionalText(60),
  religion: optionalText(60),
  customFields: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export const fetchStudentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    status: z
      .enum(['ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN', 'SUSPENDED', 'ALUMNI'])
      .optional(),
    classId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
    gender: z.enum(['MALE', 'FEMALE']).optional(),
    houseId: z.string().uuid().optional(),
  }),
});

export const searchStudentsSchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).default(''),
    pageSize: z.coerce.number().int().min(1).max(25).default(8),
  }),
});

export const createStudentSchema = z.object({ body: studentBody.strict() });

export const updateStudentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: studentBody.partial().strict(),
});

/**
 * A status change is never a silent field edit: it needs a date, and anything
 * other than returning to ACTIVE needs a reason so the audit entry means
 * something a year later.
 */
export const changeStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      status: z.enum([
        'ACTIVE',
        'GRADUATED',
        'TRANSFERRED',
        'WITHDRAWN',
        'SUSPENDED',
        'ALUMNI',
      ]),
      effectiveDate: isoDate,
      reason: optionalText(500),
      destinationSchool: optionalText(160),
    })
    .strict()
    .refine((v) => v.status !== 'TRANSFERRED' || Boolean(v.destinationSchool), {
      path: ['destinationSchool'],
      message: 'Record where the student is transferring to',
    })
    .refine((v) => v.status === 'ACTIVE' || Boolean(v.reason), {
      path: ['reason'],
      message: 'A reason is required so the change can be audited',
    }),
});

export const promoteStudentsSchema = z.object({
  body: z
    .object({
      sessionId: z.string().uuid('Select the session being closed'),
      nextSessionId: z.string().uuid('Select the session students are moving into'),
      fromClassId: z.string().uuid('Select the class being promoted'),
      toClassId: z.string().uuid('Select the destination class'),
      repeatStudentIds: z.array(z.string().uuid()).max(500).default([]),
      graduateStudentIds: z.array(z.string().uuid()).max(500).default([]),
      note: optionalText(500),
    })
    .strict(),
});

export const studentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const studentScopedParamSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
});

export type FetchStudentsQuery = z.infer<typeof fetchStudentsSchema>['query'];
export type SearchStudentsQuery = z.infer<typeof searchStudentsSchema>['query'];
export type CreateStudentInput = z.infer<typeof createStudentSchema>['body'];
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>['body'];
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>['body'];
export type PromoteStudentsInput = z.infer<typeof promoteStudentsSchema>['body'];
