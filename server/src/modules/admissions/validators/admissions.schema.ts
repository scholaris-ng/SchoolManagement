import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * What the admissions endpoints accept.
 *
 * The wording of every message here reaches a parent filling in the school's
 * public form on a phone, not only a registrar at a desk, so each rule says
 * what to do rather than what failed.
 */

const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'SCREENING',
  'SHORTLISTED',
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

/** Not in the future, and not implausibly far in the past. */
const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth as YYYY-MM-DD')
  .refine((value) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return false;
    const now = Date.now();
    const hundredYears = 100 * 365.25 * 24 * 60 * 60 * 1000;
    return parsed <= now && parsed > now - hundredYears;
  }, 'That date of birth is not a date anyone could have been born on');

export const applicationContactSchema = z.object({
  title: optionalText(16),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(160)
    .toLowerCase(),
  phone,
  occupation: optionalText(120),
  address: optionalText(300),
  city: optionalText(60),
  state: optionalText(60),
  isPrimaryContact: z.boolean().default(false),
});

export const applicantSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  middleName: optionalText(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth,
  photoUrl: z.string().url().max(500).nullable().optional(),
  nationality: optionalText(60),
  stateOfOrigin: optionalText(60),
  address: optionalText(300),
  city: optionalText(60),
  state: optionalText(60),
  previousSchool: optionalText(160),
  previousClass: optionalText(80),
  bloodGroup: optionalText(8),
  medicalNotes: optionalText(2000),
  /**
   * Only meaningful when the applicant filled the form in themselves. The
   * service ignores both for a guardian-filed application rather than storing a
   * parent's address against a child.
   */
  email: z.string().trim().email('Enter a valid email address').max(160).toLowerCase().optional().or(z.literal('')),
  phone: phone.optional().or(z.literal('')),
});

/**
 * An application must have at least one adult on it, whoever filed it. A
 * student applying for themselves still names a parent, guardian or next of
 * kin, because a school with nobody to call about a child has a safeguarding
 * problem rather than a tidy record.
 */
const contacts = z
  .array(applicationContactSchema)
  .min(1, 'Add at least one parent or guardian')
  .max(4, 'Four contacts is the most an application can carry');

export const fetchAdmissionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    status: z.enum(APPLICATION_STATUSES).optional(),
    levelId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
  }),
});

export const admissionIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('That is not an application reference') }),
});

export const createAdmissionSchema = z.object({
  body: z.object({
    applicantType: z.enum(['GUARDIAN', 'SELF']).default('GUARDIAN'),
    sessionId: z.string().uuid('Choose the session being applied for'),
    classId: z.string().uuid('Choose the class being applied for'),
    applicant: applicantSchema,
    contacts,
  }),
});

export const transitionAdmissionSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z.object({
    status: z.enum(APPLICATION_STATUSES),
    note: optionalText(2000),
    screeningScore: z.coerce.number().min(0).max(100).optional(),
    offeredClassId: z.string().uuid().optional(),
    offerExpiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as YYYY-MM-DD')
      .optional(),
  }),
});

export const convertAdmissionSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z.object({
    admissionNo: z
      .string()
      .trim()
      .min(1, 'Give the new student an admission number')
      .max(32),
    classId: z.string().uuid('Choose the class they will join'),
  }),
});

/**
 * The public form (no session, no tenant header — the slug is the tenant).
 *
 * One submission may carry several children, because a parent moving three
 * children to a new school should fill their own details in once. Each becomes
 * its own application: they are screened, offered and enrolled separately.
 */
export const publicApplicationSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'That is not a valid school address'),
  }),
  body: z.object({
    applicantType: z.enum(['GUARDIAN', 'SELF']),
    sessionId: z.string().uuid('Choose the session you are applying for'),
    applicants: z
      .array(applicantSchema.extend({ classId: z.string().uuid('Choose the class being applied for') }))
      .min(1, 'Add the details of at least one applicant')
      .max(6, 'Six children is the most one submission can carry. Send the rest separately.'),
    contacts,
    /**
     * The tick on the form. Recorded in the trail rather than a column: it is
     * evidence about this submission, and the school's terms may change.
     */
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm the details are correct before submitting' }),
    }),
  }),
});

export type FetchAdmissionsQuery = z.infer<typeof fetchAdmissionsSchema>['query'];
export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>['body'];
export type TransitionAdmissionInput = z.infer<typeof transitionAdmissionSchema>['body'];
export type ConvertAdmissionInput = z.infer<typeof convertAdmissionSchema>['body'];
export type PublicApplicationInput = z.infer<typeof publicApplicationSchema>['body'];
export type ApplicationContactInput = z.infer<typeof applicationContactSchema>;
export type ApplicantInput = z.infer<typeof applicantSchema>;
