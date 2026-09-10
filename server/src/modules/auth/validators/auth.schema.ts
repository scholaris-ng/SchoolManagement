import { z } from 'zod';

/**
 * Only these three fields are patchable.
 *
 * Memberships, roles and permissions are deliberately absent: a user must never
 * be able to widen their own access by editing their profile.
 */
export const updateProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(2, 'Please enter your full name.').max(160).optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      photoUrl: z.string().url('That is not a valid URL.').max(500).nullable().optional(),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
