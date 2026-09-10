import { attendancehandlersHandlers } from './attendance-handlers';
import { resultshandlersHandlers } from './results-handlers';

/**
 * attendance-results routes, grouped one file per area.
 *
 * MSW resolves handlers in order, so the spread below preserves the original
 * sequence exactly.
 */
export const attendanceResultsHandlers = [
  ...attendancehandlersHandlers,
  ...resultshandlersHandlers,
];
