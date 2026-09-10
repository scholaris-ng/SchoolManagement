import { z } from 'zod';
import { PERMISSIONS } from '../../../config/constants';

/**
 * A permission the server does not recognise is rejected rather than stored.
 *
 * Silently keeping an unknown string would leave a role that looks like it
 * grants something and never will — a permission list nobody can trust.
 */
const permission = z.enum(PERMISSIONS);

export const createRoleSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'A role needs a name.').max(80),
      description: z.string().trim().max(300).optional(),
      permissions: z.array(permission).max(PERMISSIONS.length).default([]),
    })
    .strict(),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      description: z.string().trim().max(300).nullable().optional(),
      permissions: z.array(permission).max(PERMISSIONS.length).optional(),
    })
    .strict(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];
