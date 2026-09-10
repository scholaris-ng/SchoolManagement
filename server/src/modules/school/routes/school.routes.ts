import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  schoolSlugParamSchema,
  updateSchoolSchema,
  updateWebsiteSchema,
} from '../validators/school.schema';
import { SchoolController } from '../controllers/school.controller';

const router = Router();

/** Public prospectus. Mounted before the authenticated routes on purpose. */
router.get(
  '/public/schools/:slug',
  validate(schoolSlugParamSchema),
  SchoolController.publicSchool,
);

router.get(
  '/schools/current',
  authMiddleware,
  tenantMiddleware,
  authorise('school.read'),
  SchoolController.current,
);

router.patch(
  '/schools/current',
  authMiddleware,
  tenantMiddleware,
  authorise('settings.manage'),
  validate(updateSchoolSchema),
  SchoolController.updateCurrent,
);

router.get(
  '/website',
  authMiddleware,
  tenantMiddleware,
  authorise('website.manage', 'school.read'),
  SchoolController.website,
);

router.patch(
  '/website',
  authMiddleware,
  tenantMiddleware,
  authorise('website.manage'),
  validate(updateWebsiteSchema),
  SchoolController.updateWebsite,
);

export default router;
