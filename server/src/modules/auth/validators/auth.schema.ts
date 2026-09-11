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
      // The parts, not the joined string: the user row keeps all three and
      // the joined one is rebuilt from these so they cannot drift apart.
      firstName: z.string().trim().min(1, 'Please enter your first name.').max(100).optional(),
      lastName: z.string().trim().min(1, 'Please enter your surname.').max(100).optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      photoUrl: z.string().url('That is not a valid URL.').max(500).nullable().optional(),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
