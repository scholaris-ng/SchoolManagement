import { z } from 'zod';

/**
 * The most an administrator can give in one go: ten years.
 *
 * "Any number of months" is the point, but not literally — a typo of `1200` for
 * `12` would hand a school a century, and nothing about it would look wrong
 * afterwards. Ten years is far beyond any real subscription and still small
 * enough that a slipped digit is refused. Mirrored on the client.
 */
export const MAX_ACTIVATION_MONTHS = 120;

export const activateSchoolSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      // Defaults to one, so a client that predates the field, or one that sends
      // no body at all, still does what the button used to.
      months: z.coerce
        .number({ invalid_type_error: 'Enter the number of months' })
        .int('Enter a whole number of months')
        .min(1, 'Activate for at least 1 month')
        .max(MAX_ACTIVATION_MONTHS, `Activate for at most ${MAX_ACTIVATION_MONTHS} months`)
        .default(1),
    })
    .strict()
    .default({}),
});

export type ActivateSchoolInput = z.infer<typeof activateSchoolSchema>['body'];
