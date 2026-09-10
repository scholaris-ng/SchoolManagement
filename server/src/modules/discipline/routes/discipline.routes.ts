import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { emptyPage, placeholderListSchema } from '../../../shared/placeholder/unbuiltModule';

/**
 * Discipline incidents. No table, so the register is empty.
 *
 * Only the list is served. Reading one incident, and moving it through its
 * stages, both stay unrouted: an incident is a formal record about a named
 * child with a review process attached, and neither reading a fabricated one
 * nor pretending to advance it is acceptable.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/discipline', authorise('discipline.read'), validate(placeholderListSchema), emptyPage);

export default router;
