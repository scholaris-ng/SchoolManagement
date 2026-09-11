import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { fetchAuditSchema } from '../validators/audit.schema';
import { AuditController } from '../controllers/audit.controller';

/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get(
  '/audit',
  authorise('audit.read'),
  validate(fetchAuditSchema),
  AuditController.fetchAll,
);

export default router;
