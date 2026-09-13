import { Router } from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import { AssessmentController } from '../controllers/assessment.controller';
import { verifyParamSchema } from '../validators/assessment.schema';

/**
 * Document verification (spec section 22): anyone holding a report card or
 * transcript can confirm the school issued it, from the code printed on it.
 * Unauthenticated by design, and answers with initials and a band rather
 * than a name and a mark — enough to check, not enough to snoop.
 */
const router = Router();

router.get('/public/verify/:code', validate(verifyParamSchema), AssessmentController.verify);

export default router;
