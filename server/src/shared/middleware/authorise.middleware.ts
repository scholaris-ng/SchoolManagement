import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { Permission } from '../../config/constants';

/**
 * Permission enforcement (spec section 5).
 *
 * Checks are always against a permission, never a role name, so a school that
 * invents "Head of Year" and gives it `result.approve` gets the access it meant
 * without a code change. The client hides controls the same way, but that is
 * only ever UX — this is the enforcement.
 */

/**
 * Names the exact permission(s) a 403 is missing, so whoever reads the error
 * (a school admin, or a user relaying it) knows precisely what to grant on the
 * Roles & Permissions screen instead of guessing from a bare "forbidden".
 */
function missingPermissionMessage(missing: Permission[]): string {
  if (missing.length === 1) return `This action takes the "${missing[0]}" permission.`;
  return `This action takes one of these permissions: ${missing.join(', ')}.`;
}

/** Passes when the caller holds any one of the listed permissions. */
export function authorise(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context = req.context;
    if (!context) {
      next(AppError.unauthenticated());
      return;
    }
    if (permissions.length === 0 || permissions.some((permission) => context.can(permission))) {
      next();
      return;
    }
    next(AppError.forbidden(missingPermissionMessage(permissions)));
  };
}

/** Passes only when the caller holds every listed permission. */
export function authoriseAll(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context = req.context;
    if (!context) {
      next(AppError.unauthenticated());
      return;
    }
    const missing = permissions.filter((permission) => !context.can(permission));
    if (missing.length === 0) {
      next();
      return;
    }
    next(AppError.forbidden(missingPermissionMessage(missing)));
  };
}
