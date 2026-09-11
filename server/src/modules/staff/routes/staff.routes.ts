import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  createStaffSchema,
  fetchStaffSchema,
  staffIdParamSchema,
  updateStaffSchema,
} from '../validators/staff.schema';
import { StaffController } from '../controllers/staff.controller';

/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

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

router.post(
  '/staff',
  authorise('staff.manage'),
  validate(createStaffSchema),
  StaffController.create,
);

router.patch(
  '/staff/:id',
  authorise('staff.manage'),
  validate(updateStaffSchema),
  StaffController.update,
);

export default router;
