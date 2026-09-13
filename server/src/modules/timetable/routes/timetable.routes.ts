import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { TimetableController } from '../controllers/timetable.controller';
import {
  entryParamSchema,
  fetchCurrentTimetableSchema,
  saveEntrySchema,
  timetableParamSchema,
} from '../validators/timetable.schema';

/**
 * The timetable (spec section 16).
 *
 * `:timetableId` is a term's id — see `TimetableEntry` for why there is no
 * separate timetable row. Reading narrows to the caller's own lessons and
 * classes in `TimetableService`; writing is `timetable.manage` outright, since
 * placing one lesson can double-book a teacher in another class.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

router.get(
  '/timetables/current',
  authorise('timetable.read'),
  validate(fetchCurrentTimetableSchema),
  TimetableController.fetchCurrent,
);

router.post(
  '/timetables/:timetableId/entries',
  authorise('timetable.manage'),
  validate(saveEntrySchema),
  TimetableController.saveEntry,
);

router.delete(
  '/timetables/:timetableId/entries/:entryId',
  authorise('timetable.manage'),
  validate(entryParamSchema),
  TimetableController.removeEntry,
);

router.delete(
  '/timetables/:timetableId/entries',
  authorise('timetable.manage'),
  validate(timetableParamSchema),
  TimetableController.clearEntries,
);

export default router;
