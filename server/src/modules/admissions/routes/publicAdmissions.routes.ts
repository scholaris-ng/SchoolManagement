import { Router } from 'express';
import { publicFormRateLimiter } from '../../../shared/middleware/rateLimiter.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { schoolSlugParamSchema } from '../../school/validators/school.schema';
import { publicApplicationSchema } from '../validators/admissions.schema';
import { AdmissionsController } from '../controllers/admissions.controller';

/**
 * The two routes a school's own website calls, and the only unauthenticated
 * write in the API.
 *
 * Mounted ahead of `authMiddleware` in app.ts, alongside the other public
 * routes. The slug in the path is what identifies the tenant: there is no
 * session and no tenant header to read, so the service resolves the school
 * from the published website record and refuses anything unpublished.
 *
 * The write carries its own, much tighter rate limit. A form anybody on the
 * internet can post to is the obvious way to fill a school's admissions list
 * with rubbish, and the general API budget is far too generous for it.
 */
const router = Router();

router.get(
  '/public/schools/:slug/admissions',
  validate(schoolSlugParamSchema),
  AdmissionsController.publicOptions,
);

router.post(
  '/public/schools/:slug/applications',
  publicFormRateLimiter,
  validate(publicApplicationSchema),
  AdmissionsController.publicSubmit,
);

export default router;
