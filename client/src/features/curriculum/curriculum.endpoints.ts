import { CurriculaEndpoints } from './curricula.endpoints';
import { SchemeEndpoints } from './schemes.endpoints';

export type {
  CoverageQuery,
  CurriculumQuery,
  GenerateSchemeInput,
  MarkCoverageInput,
  SchemeSummary,
} from './curriculum.types';
export { CurriculaEndpoints } from './curricula.endpoints';
export { SchemeEndpoints } from './schemes.endpoints';

/**
 * Curriculum is one backend module covering two distinct things — what a school
 * intends to teach, and the plans and notes derived from it — so the calls live
 * in a file each. This is the combined surface hooks import.
 */
export const CurriculumEndpoints = {
  ...CurriculaEndpoints,
  ...SchemeEndpoints,
};
