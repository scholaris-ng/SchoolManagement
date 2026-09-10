import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { fetchStaffSchema, staffIdParamSchema } from '../validators/staff.schema';
import { StaffController } from '../controllers/staff.controller';

/**
 * Reading the staff roster. Creating and updating employees is not here yet:
 * those are writes against records that carry employment history, and they land
 * with the rest of HR rather than ahead of it.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get(
  '/staff',
  authorise('staff.read'),
  validate(fetchStaffSchema),
  StaffController.fetchAll,
);

router.get(
  '/staff/:id',
  authorise('staff.read'),
  validate(staffIdParamSchema),
  StaffController.fetchOne,
);

export default router;
