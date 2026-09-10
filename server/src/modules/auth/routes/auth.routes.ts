import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authRateLimiter } from '../../../shared/middleware/rateLimiter.middleware';
import { updateProfileSchema } from '../validators/auth.schema';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

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
