import { z } from 'zod';

/**
 * Validation lives beside the feature and is shared by the form and the API
 * client. The server re-validates the same rules — this copy exists to give
 * the user an answer without a round trip, not to be the authority.
 */

const requiredString = (field: string, max = 120) =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

/** Rejects a birth date in the future or implying an implausible age. */
const dateOfBirthSchema = z
  .string()
  .min(1, 'Date of birth is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
  .refine((value) => new Date(value) < new Date(), 'Date of birth cannot be in the future')
  .refine((value) => {
    const age = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age < 30;
  }, 'That date of birth looks wrong for a student');

export const studentFormSchema = z.object({
  admissionNo: z
    .string()
    .trim()
    .min(1, 'Admission number is required')
    .max(32, 'Admission number is too long')
    .regex(/^[A-Za-z0-9/\-_]+$/, 'Use letters, numbers, hyphens and slashes only'),
  firstName: requiredString('First name', 60),
  middleName: z.string().trim().max(60).optional().or(z.literal('')),
  lastName: requiredString('Surname', 60),
  gender: z.enum(['MALE', 'FEMALE'], { required_error: 'Select a gender' }),
  dateOfBirth: dateOfBirthSchema,
  admissionDate: z.string().min(1, 'Admission date is required'),
  currentClassId: z.string().min(1, 'Select a class'),
  houseId: z.string().optional().or(z.literal('')),
  photoUrl: z.string().optional().nullable(),
  photoStoragePath: z.string().optional().nullable(),
  /**
   * Consent is explicit and defaults to false. Nothing publishes a child's
   * photograph until somebody has actively said yes (spec section 41).
   */
  photoConsent: z.boolean().default(false),
  bloodGroup: z.string().trim().max(8).optional().or(z.literal('')),
  medicalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal('')),
  emergencyContactPhone: phoneSchema.optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  nationality: z.string().trim().max(60).optional().or(z.literal('')),
  stateOfOrigin: z.string().trim().max(60).optional().or(z.literal('')),
  religion: z.string().trim().max(60).optional().or(z.literal('')),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export const statusChangeSchema = z
  .object({
    status: z.enum(['ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN', 'SUSPENDED', 'ALUMNI']),
    effectiveDate: z.string().min(1, 'Select the date this takes effect'),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
    destinationSchool: z.string().trim().max(160).optional().or(z.literal('')),
  })
  .refine(
    (values) => values.status !== 'TRANSFERRED' || Boolean(values.destinationSchool),
    { path: ['destinationSchool'], message: 'Record where the student is transferring to' },
  )
  .refine((values) => values.status === 'ACTIVE' || Boolean(values.reason), {
    path: ['reason'],
    message: 'A reason is required so the change can be audited',
  });

export type StatusChangeValues = z.infer<typeof statusChangeSchema>;

export const promotionSchema = z.object({
  sessionId: z.string().min(1, 'Select the session being closed'),
  nextSessionId: z.string().min(1, 'Select the session students are moving into'),
  fromClassId: z.string().min(1, 'Select the class being promoted'),
  toClassId: z.string().min(1, 'Select the destination class'),
  /** Students explicitly held back; everyone else in the class moves up. */
  repeatStudentIds: z.array(z.string()).default([]),
  graduateStudentIds: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export type PromotionValues = z.infer<typeof promotionSchema>;

export const guardianLinkSchema = z.object({
  guardianId: z.string().min(1, 'Select a guardian'),
  relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  isFinanciallyResponsible: z.boolean().default(false),
  canPickUp: z.boolean().default(true),
});

export type GuardianLinkValues = z.infer<typeof guardianLinkSchema>;
