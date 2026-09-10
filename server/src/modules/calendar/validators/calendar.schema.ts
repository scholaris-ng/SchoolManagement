import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.');

export const fetchCalendarSchema = z.object({
  query: z
    .object({
      from: isoDate.optional(),
      to: isoDate.optional(),
      // Free text rather than an enum: a school names its own event
      // categories, and no catalogue of them exists to check against.
      category: z.string().trim().max(40).optional(),
    })
    .strict()
    .refine((value) => !value.from || !value.to || value.to >= value.from, {
      message: 'The end of the range cannot come before its start.',
      path: ['to'],
    }),
});
