import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  createGuardianSchema,
  fetchGuardiansSchema,
  guardianIdParamSchema,
  guardianScopedParamSchema,
  linkGuardianSchema,
  unlinkGuardianSchema,
  updateGuardianSchema,
} from '../validators/guardians.schema';
import { GuardiansController } from '../controllers/guardians.controller';

/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get(
  '/guardians',
  authorise('guardian.read'),
  validate(fetchGuardiansSchema),
  GuardiansController.fetchAll,
);

// Before `/guardians/:id` would be ambiguous, so the more specific path first.
router.get(
  '/guardians/:id/children',
  authorise('guardian.read'),
  validate(guardianIdParamSchema),
  GuardiansController.fetchChildren,
);

router.get(
  '/guardians/:id',
  authorise('guardian.read'),
  validate(guardianIdParamSchema),
  GuardiansController.fetchOne,
);

router.post(
  '/guardians',
  authorise('guardian.manage'),
  validate(createGuardianSchema),
  GuardiansController.create,
);

router.patch(
  '/guardians/:id',
  authorise('guardian.manage'),
  validate(updateGuardianSchema),
  GuardiansController.update,
);

router.post(
  '/guardians/:guardianId/invite',
  authorise('guardian.manage'),
  validate(guardianScopedParamSchema),
  GuardiansController.invite,
);

// ─── Reached from a student rather than a guardian ──────────────────────────
router.get(
  '/students/:studentId/guardians',
  authorise('student.read'),
  validate(linkGuardianSchema.pick({ params: true })),
  GuardiansController.fetchForStudent,
);

router.post(
  '/students/:studentId/guardians',
  authorise('guardian.manage'),
  validate(linkGuardianSchema),
  GuardiansController.link,
);

router.delete(
  '/students/:studentId/guardians/:linkId',
  authorise('guardian.manage'),
  validate(unlinkGuardianSchema),
  GuardiansController.unlink,
);

export default router;
