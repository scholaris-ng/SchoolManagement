import { curriculaHandlers } from './curricula-handlers';
import { schemesHandlers } from './schemes-handlers';
import { lessonNoteHandlers } from './lesson-note-handlers';

/**
 * curriculum-handlers routes, grouped one file per area.
 *
 * MSW resolves handlers in order, so the spread below preserves the original
 * sequence exactly.
 */
export const curriculumHandlers = [
  ...curriculaHandlers,
  ...schemesHandlers,
  ...lessonNoteHandlers,
];
