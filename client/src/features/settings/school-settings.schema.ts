import { z } from 'zod';
import type { School } from '@/types/tenant';

/**
 * Mirrors `updateSchoolSchema` on the server so a bad value is caught before
 * the request goes out, not after a round trip.
 *
 * Most fields also accept `''` because a blank box is a valid thing to submit
 * here — it means "don't touch this", and it is `editableFields()` in the
 * page, not this schema, that decides whether that gets dropped or sent as a
 * clear. `phone`, `addressLine1`, `city` and `state` are the exception: the
 * school must always have these on file, so an empty box fails validation
 * instead of silently passing through, and `save()` never sends the request.
 */
export const schoolSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter the school name.')
    .max(200, 'The school name is too long. Use 200 characters or fewer.')
    .optional()
    .or(z.literal('')),
  shortName: z
    .string()
    .trim()
    .max(60, 'The short name is too long. Use 60 characters or fewer.')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address, such as office@yourschool.edu.ng')
    .max(160, 'That email address is too long.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .min(6, 'Enter a full phone number, including the area or country code.')
    .max(40, 'That phone number is too long.'),
  website: z
    .string()
    .trim()
    .url('Enter the full web address, starting with https://')
    .max(200, 'That web address is too long.')
    .optional()
    .or(z.literal('')),
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Enter the street address.')
    .max(200, 'That address line is too long. Use 200 characters or fewer.'),
  city: z
    .string()
    .trim()
    .min(1, 'Enter the town or city.')
    .max(80, 'That town or city name is too long.'),
  state: z
    .string()
    .trim()
    .min(1, 'Enter the state or region.')
    .max(80, 'That state or region name is too long.'),
});

/** Runs the schema over a form draft and returns messages keyed by field, for the same `Field` `error` slot server responses use. */
export function validateSchoolDraft(draft: Partial<School>): Record<string, string> {
  const result = schoolSettingsSchema.safeParse({
    name: draft.name ?? '',
    shortName: draft.shortName ?? '',
    email: draft.email ?? '',
    phone: draft.phone ?? '',
    website: draft.website ?? '',
    addressLine1: draft.addressLine1 ?? '',
    city: draft.city ?? '',
    state: draft.state ?? '',
  });

  if (result.success) return {};

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
