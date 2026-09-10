import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { createRoleSchema, updateRoleSchema } from '../validators/role.schema';
import { RoleController } from '../controllers/role.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

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
