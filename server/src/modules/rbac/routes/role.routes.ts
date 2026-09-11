import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { createRoleSchema, updateRoleSchema } from '../validators/role.schema';
import { RoleController } from '../controllers/role.controller';

/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get('/roles', authorise('role.manage'), RoleController.fetchAll);

router.post(
  '/roles',
  authorise('role.manage'),
  validate(createRoleSchema),
  RoleController.create,
);

router.patch(
  '/roles/:id',
  authorise('role.manage'),
  validate(updateRoleSchema),
  RoleController.update,
);

export default router;
