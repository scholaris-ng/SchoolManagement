import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { subscriptionAdminMiddleware } from '../../../shared/middleware/subscriptionAdmin.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { PlatformSchoolsController } from '../controllers/platformSchools.controller';
import {
  activateSchoolSchema,
  schoolIdParamSchema,
  topUpSmsCreditsSchema,
} from '../validators/platform.schema';

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

// The platform's own SMS gateway balance, against the credit promised to schools.
router.get('/platform/sms/status', authMiddleware, subscriptionAdminMiddleware, PlatformSchoolsController.smsStatus);

// Prepaid SMS credit: what a school has, how it got there, and adding more.
router.get(
  '/platform/schools/:id/sms-credits',
  authMiddleware,
  subscriptionAdminMiddleware,
  validate(schoolIdParamSchema),
  PlatformSchoolsController.smsCredits,
);

router.post(
  '/platform/schools/:id/sms-credits',
  authMiddleware,
  subscriptionAdminMiddleware,
  validate(topUpSmsCreditsSchema),
  PlatformSchoolsController.topUpSmsCredits,
);

export default router;
