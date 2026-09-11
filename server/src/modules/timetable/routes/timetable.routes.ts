import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { TimetableService } from '../services/timetable.service';

/**
 * Reading the current timetable. Saving an entry, clearing a grid and checking
 * it for clashes are all writes against a table that does not exist, so none of
 * them is routed.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

/**
 * The three filters narrow the grid to one class, teacher or room. They are
 * accepted and not yet applied: with no entries there is nothing to narrow, and
 * refusing them would break the page's own filter bar.
 */
const fetchCurrentTimetableSchema = z.object({
  query: z
    .object({
      classId: z.string().uuid().optional(),
      teacherId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
    })
    .strict(),
});

router.get(
  '/timetables/current',
  authorise('timetable.read'),
  validate(fetchCurrentTimetableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(200)
        .json(ApiResponse.ok(await TimetableService.Instance.fetchCurrent(contextOf(req))));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
