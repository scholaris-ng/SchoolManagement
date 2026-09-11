import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { AppError } from '../../../shared/errors/AppError';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { SessionService } from '../services/session.service';
import { ProfileService } from '../services/profile.service';
import { RegistrationService } from '../services/registration.service';
import type { UpdateProfileInput } from '../validators/auth.schema';
import type {
  ForgotPasswordInput,
  RegisterSchoolInput,
  ResendVerificationInput,
  VerifyEmailInput,
} from '../validators/registration.schema';

/** Thin coordinator: read validated input, call the service, wrap the result. */
export class AuthController {
  /**
   * Unauthenticated. Creates a school administrator and their school in one
   * call, then emails a verification code.
   *
   * Returns no token: the account is unusable until the code is entered, so
   * there is nothing to hand back yet.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RegistrationService.Instance.register(
        req.validated!.body as RegisterSchoolInput,
      );
      res
        .status(201)
        .json(
          ApiResponse.created(result, 'Check your email for a six-digit verification code.'),
        );
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RegistrationService.Instance.verifyEmail(
        req.validated!.body as VerifyEmailInput,
      );
      res.status(200).json(ApiResponse.ok(result, 'Email verified. You can sign in now.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Answers identically whether or not the address exists, so this cannot be
   * used to discover which emails have accounts.
   */
  static async resendVerification(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await RegistrationService.Instance.resendVerification(
        req.validated!.body as ResendVerificationInput,
      );
      res
        .status(200)
        .json(
          ApiResponse.ok(result, 'If that address has an unverified account, a new code is on its way.'),
        );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unauthenticated. Emails a link for setting a new password.
   *
   * Like `resendVerification`, the answer is the same whether or not the
   * address has an account, so this cannot be used to discover which ones do.
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RegistrationService.Instance.forgotPassword(
        req.validated!.body as ForgotPasswordInput,
      );
      res
        .status(200)
        .json(ApiResponse.ok(result, 'If that address has an account, a reset link is on its way.'));
    } catch (error) {
      next(error);
    }
  }

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
