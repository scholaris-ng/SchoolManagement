import { z } from 'zod';

export const guardianFormSchema = z
  .object({
    title: z.string().trim().max(16).optional().or(z.literal('')),
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().min(1, 'Surname is required').max(60),
    /**
     * Optional — a guardian who doesn't want a parent-portal account has no
     * use for one yet. It can be added later, whenever they do.
     */
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .toLowerCase()
      .optional()
      .or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number'),
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
