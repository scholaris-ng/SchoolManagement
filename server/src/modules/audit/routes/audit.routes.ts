import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { fetchAuditSchema } from '../validators/audit.schema';
import { AuditController } from '../controllers/audit.controller';

const router = Router();

router.get(
  '/audit',
  authMiddleware,
  tenantMiddleware,
  authorise('audit.read'),
  validate(fetchAuditSchema),
  AuditController.fetchAll,
);

export default router;
