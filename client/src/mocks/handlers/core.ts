import { sessionhandlersHandlers } from './session-handlers';
import { academicstructurehandlersHandlers } from './academic-structure-handlers';
import { filehandlersHandlers } from './file-handlers';
import { audithandlersHandlers } from './audit-handlers';
import { healthhandlersHandlers } from './health-handlers';

/**
 * core routes, grouped one file per area.
 *
 * MSW resolves handlers in order, so the spread below preserves the original
 * sequence exactly.
 */
export const coreHandlers = [
  ...sessionhandlersHandlers,
  ...academicstructurehandlersHandlers,
  ...filehandlersHandlers,
  ...audithandlersHandlers,
  ...healthhandlersHandlers,
];
