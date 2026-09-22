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

/**
 * The most credit one top-up may add: a million message pages. Far beyond any
 * real purchase, and small enough that a slipped digit is refused rather than
 * handed over — the same reasoning as `MAX_ACTIVATION_MONTHS`.
 */
export const MAX_SMS_CREDIT_TOPUP = 1_000_000;

/**
 * A top-up is entered as money — what the school actually paid — and the
 * server converts it to SMS pages at `SMS_UNIT_PRICE_NGN`, rounding down so
 * the platform never gives away a fraction of a page. ₦5,000 at ₦8 is 625.
 */
export const topUpSmsCreditsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      amountNgn: z.coerce
        .number({ invalid_type_error: 'Enter the amount paid, in naira' })
        .positive('Enter the amount paid, in naira')
        .max(MAX_SMS_CREDIT_TOPUP * 1000, 'That amount is too large for one top-up'),
      /** How it was paid, and when — whatever should be remembered against this credit. */
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
});

export type TopUpSmsCreditsInput = z.infer<typeof topUpSmsCreditsSchema>['body'];

export const schoolIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
