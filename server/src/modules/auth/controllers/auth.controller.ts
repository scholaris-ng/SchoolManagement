import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { AppError } from '../../../shared/errors/AppError';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { SessionService } from '../services/session.service';
import { ProfileService } from '../services/profile.service';
import type { UpdateProfileInput } from '../validators/auth.schema';

/** Thin coordinator: read validated input, call the service, wrap the result. */
export class AuthController {
  /**
   * The one route that runs without `tenantMiddleware`: a user with no
   * membership yet must still be able to load a session and be told so, rather
   * than being bounced with a 403 they cannot act on.
   */
  static async session(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identity = req.identity;
      if (!identity) throw AppError.unauthenticated();

      const requested = req.get('x-school-id')?.trim() || null;
      const session = await SessionService.Instance.buildSession(identity, requested);

      res.status(200).json(ApiResponse.ok(session));
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as UpdateProfileInput;
      const user = await ProfileService.Instance.updateProfile(contextOf(req), body);

      res.status(200).json(ApiResponse.ok(user, 'Profile updated'));
    } catch (error) {
      next(error);
    }
  }
}
