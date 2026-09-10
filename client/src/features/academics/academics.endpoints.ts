import { AcademicsStructureEndpoints } from './academics-structure.endpoints';
import { AcademicsResourceEndpoints } from './academics-resources.endpoints';

export type { ClassQuery, SubjectQuery, SessionPayload } from './academics.types';
export { AcademicsStructureEndpoints } from './academics-structure.endpoints';
export { AcademicsResourceEndpoints } from './academics-resources.endpoints';

/**
 * The academic structure is one backend module but two clearly separate
 * concerns — the shape of the year, and what the school teaches with — so the
 * calls live in a file each. This is the combined surface hooks import.
 */
export const AcademicsEndpoints = {
  ...AcademicsStructureEndpoints,
  ...AcademicsResourceEndpoints,
};
