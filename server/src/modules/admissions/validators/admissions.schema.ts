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

/**
 * The office's own version of a contact — a phone-only contact is still
 * reachable, so email is not required the way it is on the public form,
 * which has no other channel to fall back on. A contact recorded this way
 * gets none of the emailed updates, and `AdmissionsService.convert` will ask
 * for an email before promoting it into a `Guardian`, whose own email is
 * required and unique.
 */
export const officeApplicationContactSchema = applicationContactSchema.extend({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(160)
    .toLowerCase()
    .optional()
    .or(z.literal('')),
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
 * An application must eventually have at least one adult on it, whoever filed
 * it — a school with nobody to call about a child has a safeguarding problem
 * rather than a tidy record. The public form has no other way to name one, so
 * it is required there. The office may instead attach an existing `Guardian`
 * record once one is known (a sibling's parent, say) — see
 * `linkApplicationGuardianSchema` — so typed-in contacts are optional there,
 * and enrolment does not require any: a guardian can be added to the student
 * afterwards.
 */
const contacts = z
  .array(applicationContactSchema)
  .min(1, 'Add at least one parent or guardian')
  .max(4, 'Four contacts is the most an application can carry');

const officeContacts = z
  .array(officeApplicationContactSchema)
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
    contacts: officeContacts.default([]),
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

/**
 * Scheduling an interview and recording how it went — separate from
 * `transition` because it never changes `status` on its own. A school can set
 * a date and venue while an applicant is merely `SUBMITTED`, and record an
 * outcome without that alone deciding anything; the office still moves the
 * status along itself once it knows what it wants to do about it.
 */
export const scheduleInterviewSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z
    .object({
      /** `null` clears a date that turned out to be wrong; omit to leave it alone. */
      interviewDate: z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional(),
      interviewVenue: optionalText(200).nullable(),
      interviewOutcome: z.enum(['PASSED', 'FAILED']).nullable().optional(),
      interviewNote: optionalText(2000).nullable(),
    })
    .refine(
      (body) => Object.values(body).some((value) => value !== undefined),
      'Provide at least one detail to update',
    ),
});

/**
 * Correcting a screening score after the fact — separate from `transition`
 * for the same reason interviews are: a typo, or a rescore, is not a status
 * change, and forcing one through a decision the office isn't actually making
 * again would be the wrong tool. `transition` still sets the score too, for
 * the common case of recording it in the same breath as moving to
 * `SCREENING` or `SHORTLISTED`.
 */
export const updateScreeningScoreSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z.object({
    /** `null` clears a score entered in error; omit is not offered — there is nothing else on this call to update instead. */
    screeningScore: z.coerce.number().min(0).max(100).nullable(),
  }),
});

export const convertAdmissionSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z.object({
    classId: z.string().uuid('Choose the class they will join'),
  }),
});

/**
 * Attaching an existing `Guardian` record to an application before
 * enrollment — a family the office already knows. Only the relationship and
 * who is primary are asked here; everything else about the pairing (portal
 * access, billing, pickup) still waits for enrollment, the same as `contacts`.
 */
export const linkApplicationGuardianSchema = z.object({
  params: admissionIdParamSchema.shape.params,
  body: z
    .object({
      guardianId: z.string().uuid('Choose a guardian'),
      relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
      isPrimaryContact: z.boolean().default(false),
    })
    .strict(),
});

export const unlinkApplicationGuardianSchema = z.object({
  params: z.object({
    id: z.string().uuid('That is not an application reference'),
    linkId: z.string().uuid(),
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

/**
 * The token in the "respond to this offer" link a family is emailed — a
 * URL-safe random string, not a uuid, so it is validated by shape rather than
 * format the way `slug` or an id would be.
 */
const offerTokenParam = z.object({
  token: z.string().trim().min(16).max(200),
});

export const offerTokenParamSchema = z.object({ params: offerTokenParam });

export const respondToOfferSchema = z.object({
  params: offerTokenParam,
  body: z.object({
    action: z.enum(['ACCEPT', 'DECLINE'], {
      errorMap: () => ({ message: 'Say whether the place is being accepted or declined' }),
    }),
  }),
});

export type FetchAdmissionsQuery = z.infer<typeof fetchAdmissionsSchema>['query'];
export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>['body'];
export type TransitionAdmissionInput = z.infer<typeof transitionAdmissionSchema>['body'];
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>['body'];
export type UpdateScreeningScoreInput = z.infer<typeof updateScreeningScoreSchema>['body'];
export type ConvertAdmissionInput = z.infer<typeof convertAdmissionSchema>['body'];
export type LinkApplicationGuardianInput = z.infer<typeof linkApplicationGuardianSchema>['body'];
export type PublicApplicationInput = z.infer<typeof publicApplicationSchema>['body'];
export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>['body'];
export type ApplicationContactInput = z.infer<typeof applicationContactSchema>;
export type OfficeApplicationContactInput = z.infer<typeof officeApplicationContactSchema>;
export type ApplicantInput = z.infer<typeof applicantSchema>;
