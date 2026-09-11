import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authRateLimiter } from '../../../shared/middleware/rateLimiter.middleware';
import { updateProfileSchema } from '../validators/auth.schema';
import {
  forgotPasswordSchema,
  registerSchoolSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '../validators/registration.schema';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

/**
 * School self-registration. Unauthenticated by necessity — the caller has no
 * account yet — and rate limited harder than the rest of the API, because these
 * three routes create accounts and send mail.
 */
router.post(
  '/auth/register',
  authRateLimiter,
  validate(registerSchoolSchema),
  AuthController.register,
);

router.post(
  '/auth/verify-email',
  authRateLimiter,
  validate(verifyEmailSchema),
  AuthController.verifyEmail,
);

router.post(
  '/auth/resend-verification',
  authRateLimiter,
  validate(resendVerificationSchema),
  AuthController.resendVerification,
);

/**
 * The reset link is generated here and sent in our own template rather than by
 * the identity provider, so it reads like every other mail a school sends.
 */
router.post(
  '/auth/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword,
);

/**
 * Authenticated but deliberately not tenant-scoped — see the note on
 * `AuthController.session`.
 */
router.get('/auth/session', authRateLimiter, authMiddleware, AuthController.session);

router.patch(
  '/users/me',
  authMiddleware,
  tenantMiddleware,
  validate(updateProfileSchema),
  AuthController.updateMe,
);

export default router;
