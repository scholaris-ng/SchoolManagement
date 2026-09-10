import { curriculumHandlers } from './curriculum-handlers';
import { timetableHandlers } from './timetable-handlers';
import { calendarHandlers } from './calendar-handlers';
import { cbtHandlers } from './cbt-handlers';

/**
 * academics-extra routes, grouped one file per area.
 *
 * MSW resolves handlers in order, so the spread below preserves the original
 * sequence exactly.
 */
export const academicsExtraHandlers = [
  ...curriculumHandlers,
  ...timetableHandlers,
  ...calendarHandlers,
  ...cbtHandlers,
];
