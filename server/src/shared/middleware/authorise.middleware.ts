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
    next(AppError.forbidden());
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
    if (permissions.every((permission) => context.can(permission))) {
      next();
      return;
    }
    next(AppError.forbidden());
  };
}
