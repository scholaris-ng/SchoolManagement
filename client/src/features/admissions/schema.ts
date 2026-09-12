import { z } from 'zod';

/**
 * One description of an application, used by both forms that produce one.
 *
 * The office form and the school's public website ask for the same things in
 * the same shape, because they produce the same record — the only differences
 * are how much of it is optional for a visitor on a phone and the fact that a
 * parent may file for several children at once. Keeping the pieces here is
 * what stops the two drifting into subtly different definitions of a child.
 */

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
] as const;

/**
 * A parent, guardian or next of kin as they appear on an application.
 *
 * Not a guardian record: nobody here gets a login, a listing or a bill until
 * the child is enrolled. See `ApplicationContact` in `@/types/admissions`.
 */
export const applicationContactSchema = z.object({
  title: optional(16),
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
  occupation: optional(120),
  address: optional(300),
  city: optional(60),
  state: optional(60),
  isPrimaryContact: z.boolean().default(false),
});

export const applicantSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  middleName: optional(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  photoUrl: z.string().url().nullable().optional(),
  nationality: optional(60),
  stateOfOrigin: optional(60),
  address: optional(300),
  city: optional(60),
  state: optional(60),
  previousSchool: optional(160),
  previousClass: optional(80),
  bloodGroup: optional(8),
  medicalNotes: optional(2000),
  /** Required of an applicant applying for themselves, ignored otherwise. */
  email: z.string().trim().email('Enter a valid email address').max(160).toLowerCase().optional().or(z.literal('')),
  phone: phone.optional().or(z.literal('')),
});

export type ApplicantValues = z.infer<typeof applicantSchema>;
export type ApplicationContactValues = z.infer<typeof applicationContactSchema>;

/**
 * An applicant old enough to apply for themselves must be reachable directly —
 * that is the whole difference between the two paths, and the school will be
 * writing to them rather than to a parent.
 */
export function requireOwnContactDetails(
  applicant: Pick<ApplicantValues, 'email' | 'phone'>,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (!applicant.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'email'],
      message: 'Enter the email address the school should write to',
    });
  }
  if (!applicant.phone) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'phone'],
      message: 'Enter a phone number the school can call',
    });
  }
}

/** What the office form posts — one applicant, filed by whoever is at the desk. */
export const admissionFormSchema = z
  .object({
    applicantType: z.enum(['GUARDIAN', 'SELF']),
    sessionId: z.string().min(1, 'Choose the session being applied for'),
    levelId: z.string().min(1, 'Choose the level being applied for'),
    applicant: applicantSchema,
    /**
     * At least one adult, whoever applied. An application with nobody the
     * school can call is unusable, and an applicant applying for themselves
     * still names a parent, guardian or next of kin.
     */
    contacts: z.array(applicationContactSchema).min(1, 'Add at least one parent or guardian'),
  })
  .superRefine((values, context) => {
    if (values.applicantType === 'SELF') {
      requireOwnContactDetails(values.applicant, context, ['applicant']);
    }
  });

export type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

export const conversionSchema = z.object({
  admissionNo: z.string().trim().min(1, 'Give the new student an admission number').max(32),
  classId: z.string().min(1, 'Choose the class they will join'),
});

export type ConversionValues = z.infer<typeof conversionSchema>;
