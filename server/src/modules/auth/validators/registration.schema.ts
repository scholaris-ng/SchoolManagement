import { z } from 'zod';

/**
 * Password rules (spec section 40).
 *
 * Length does more for strength than character-class rules, so the floor is
 * generous and the only composition requirement is that it is not a single
 * repeated character. Firebase enforces its own minimum of six on top.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'That password is too long.')
  .refine((value) => new Set(value).size > 3, {
    message: 'Please choose a less predictable password.',
  });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(160);

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the six-digit code from your email.');

/**
 * School self-registration: one call creates the administrator's account and
 * their school. Everything else about the school — address, levels, classes —
 * is filled in afterwards from the settings screen.
 */
export const registerSchoolSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1, 'Enter your first name.').max(100),
      lastName: z.string().trim().min(1, 'Enter your last name.').max(100),
      schoolName: z.string().trim().min(2, 'Enter your school name.').max(200),
      email,
      password,
    })
    .strict(),
});

export const verifyEmailSchema = z.object({
  body: z.object({ email, code }).strict(),
});

export const resendVerificationSchema = z.object({
  body: z.object({ email }).strict(),
});

export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];
