import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { subscriptionAdminMiddleware } from '../../../shared/middleware/subscriptionAdmin.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { PlatformSchoolsController } from '../controllers/platformSchools.controller';
import { activateSchoolSchema } from '../validators/platform.schema';

/**
 * Platform administration: acting on every school, not on the caller's own.
 *
 * Mounted ahead of the shared `tenantMiddleware` in `app.ts` and carrying its
 * own guard instead, for the reason `subscriptionAdminMiddleware` gives.
 */
const router = Router();

router.get(
  '/platform/schools',
  authMiddleware,
  subscriptionAdminMiddleware,
  PlatformSchoolsController.list,
);

router.post(
  '/platform/schools/:id/activate',
  authMiddleware,
  subscriptionAdminMiddleware,
  validate(activateSchoolSchema),
  PlatformSchoolsController.activate,
);

export default router;
