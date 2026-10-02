import { z } from 'zod';

/**
 * Optional — a guardian who doesn't want a parent-portal account has no
 * use for one yet. It can be added later, whenever they do.
 */
const optionalEmail = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .toLowerCase()
  .optional()
  .or(z.literal(''));

const phoneNumber = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

export const guardianFormSchema = z
  .object({
    title: z.string().trim().max(16).optional().or(z.literal('')),
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().min(1, 'Surname is required').max(60),
    email: optionalEmail,
    phone: phoneNumber,
    altPhone: z
      .string()
      .trim()
      .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number')
      .optional()
      .or(z.literal('')),
    occupation: z.string().trim().max(120).optional().or(z.literal('')),
    address: z.string().trim().max(300).optional().or(z.literal('')),
    /**
     * The guardian account is what the parent signs in with. It belongs to the
     * person, not to a child, so one login covers every child they have at the
     * school (research feature 2).
     */
    grantPortalAccess: z.boolean().default(false),
  })
  .superRefine((values, context) => {
    if (values.grantPortalAccess && !values.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Add an email address to invite this guardian to the parent portal.',
      });
    }
  });

export type GuardianFormValues = z.infer<typeof guardianFormSchema>;

/** Linking a guardian to a child from the guardian's own page — the reverse of `guardianLinkSchema` on the student's. */
export const linkStudentSchema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  isFinanciallyResponsible: z.boolean().default(false),
  canPickUp: z.boolean().default(true),
});

export type LinkStudentValues = z.infer<typeof linkStudentSchema>;

/**
 * A second guardian for the same children, added from the first one's page —
 * the mother, from the father's. A new person plus the link flags that will be
 * written once per selected child, so only what a household actually knows is
 * asked for; email stays optional, and so does everything else on the full form.
 */
export const coGuardianSchema = z.object({
  relationship: linkStudentSchema.shape.relationship,
  title: z.string().trim().max(16).optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  phone: phoneNumber,
  email: optionalEmail,
  studentIds: z.array(z.string()).min(1, 'Select at least one child'),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  isFinanciallyResponsible: z.boolean().default(false),
  canPickUp: z.boolean().default(true),
});

export type CoGuardianValues = z.infer<typeof coGuardianSchema>;
