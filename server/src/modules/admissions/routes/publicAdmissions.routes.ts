import { Router } from 'express';
import { publicFormRateLimiter } from '../../../shared/middleware/rateLimiter.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { schoolSlugParamSchema } from '../../school/validators/school.schema';
import {
  offerTokenParamSchema,
  publicApplicationSchema,
  respondToOfferSchema,
} from '../validators/admissions.schema';
import { AdmissionsController } from '../controllers/admissions.controller';

/**
 * The routes a school's own website calls, and the family's own "respond to
 * this offer" link — the only unauthenticated writes in the API.
 *
 * Mounted ahead of `authMiddleware` in app.ts, alongside the other public
 * routes. The application routes are identified by the school's slug; the
 * offer routes carry no tenant at all, because the token in the path already
 * names one specific application uniquely — the same way a password-reset
 * link is trusted on its own, without a second identifier alongside it.
 *
 * The writes carry their own, much tighter rate limit. A form or a link
 * anybody on the internet can post to is the obvious way to fill a school's
 * admissions list with rubbish or grind through a token by brute force, and
 * the general API budget is far too generous for either.
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

router.get(
  '/public/offers/:token',
  publicFormRateLimiter,
  validate(offerTokenParamSchema),
  AdmissionsController.publicOffer,
);

router.post(
  '/public/offers/:token/respond',
  publicFormRateLimiter,
  validate(respondToOfferSchema),
  AdmissionsController.respondToOffer,
);

export default router;
