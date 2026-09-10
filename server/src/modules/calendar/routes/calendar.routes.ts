import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { fetchCalendarSchema } from '../validators/calendar.schema';

/**
 * The school calendar, with no events table behind it.
 *
 * The admin dashboard already reports its "upcoming events" strip as empty for
 * the same reason. This serves the calendar screen the same empty answer rather
 * than a 404, so the month grid draws and a school sees an empty term instead
 * of a failed page. Creating and editing events waits for the table.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

/** The client types this as a bare array, not a page. */
router.get(
  '/calendar',
  authorise('calendar.read'),
  validate(fetchCalendarSchema),
  (_req: Request, res: Response) => {
    res.status(200).json(ApiResponse.ok([]));
  },
);

export default router;
