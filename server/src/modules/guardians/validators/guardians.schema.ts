import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const guardianBody = z.object({
  title: optionalText(16),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(160),
  phone,
  altPhone: phone.optional().or(z.literal('')),
  occupation: optionalText(120),
  address: optionalText(300),
  /**
   * The account belongs to the person, not to a child, so one login covers
   * every child they have at the school.
   */
  grantPortalAccess: z.boolean().default(true),
});

export const fetchGuardiansSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export const createGuardianSchema = z.object({ body: guardianBody.strict() });

export const updateGuardianSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: guardianBody.partial().strict(),
});

export const guardianIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const guardianScopedParamSchema = z.object({
  params: z.object({ guardianId: z.string().uuid() }),
});

/**
 * Linking a guardian to a child. Every flag is explicit — who to call, who may
 * collect and who pays are separate safeguarding and billing decisions, and
 * none of them should be inferred from the relationship type.
 */
export const linkGuardianSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  body: z
    .object({
      guardianId: z.string().uuid(),
      relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
      isPrimaryContact: z.boolean().default(false),
      isEmergencyContact: z.boolean().default(false),
      isFinanciallyResponsible: z.boolean().default(false),
      canPickUp: z.boolean().default(false),
    })
    .strict(),
});

export const unlinkGuardianSchema = z.object({
  params: z.object({ studentId: z.string().uuid(), linkId: z.string().uuid() }),
});

export type FetchGuardiansQuery = z.infer<typeof fetchGuardiansSchema>['query'];
export type CreateGuardianInput = z.infer<typeof createGuardianSchema>['body'];
export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>['body'];
export type LinkGuardianInput = z.infer<typeof linkGuardianSchema>['body'];
