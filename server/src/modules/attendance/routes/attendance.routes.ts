import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { AttendanceController } from '../controllers/attendance.controller';
import { fetchRegisterSchema, saveRegisterSchema } from '../validators/attendance.schema';

/**
 * The daily register.
 *
 * `/attendance/summary` and `/attendance/trend` are not here: they are
 * aggregates served by the analytics module, which owns every cross-class
 * figure in the app and keeps these paths because the client named them before
 * either module existed (see `analytics.routes.ts`).
 *
 * Reading is gated on `attendance.manage`, not `attendance.read`. The register
 * lists every child in a room by name, with a photograph and the reason each
 * absent one was away, and the roles that hold only `attendance.read` are
 * parents and pupils — who see their own attendance through the portal, never a
 * whole class's. Which of the school's classes a staff member may then open is
 * narrowed per class in `AttendanceService`.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get(
  '/attendance/register',
  authorise('attendance.manage'),
  validate(fetchRegisterSchema),
  AttendanceController.fetchRegister,
);

router.post(
  '/attendance/register',
  authorise('attendance.manage'),
  validate(saveRegisterSchema),
  AttendanceController.saveRegister,
);

export default router;
