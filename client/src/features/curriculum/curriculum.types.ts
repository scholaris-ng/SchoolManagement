import type { SchemeOfWork } from '@/types/curriculum';

/** Query and payload shapes shared by the curriculum endpoint files. */

/** The scheme list omits the weeks; only the detail view needs them. */
export interface SchemeSummary extends Omit<SchemeOfWork, 'weeks'> {
  weeks: [];
  weekCount: number;
}

/** Type aliases so these keep the implicit index signature the transport needs. */
export type CurriculumQuery = {
  subjectId?: string;
  levelId?: string;
  classId?: string;
  /**
   * Omit to get the school's current session, which is what almost every
   * caller wants. Pass `'ALL'` to look across previous years.
   */
  sessionId?: string;
  /** Narrows the list to one author — "written by me". */
  createdById?: string;
};

export type CoverageQuery = { curriculumId?: string; classId?: string };

export interface MarkCoverageInput {
  objectiveIds: string[];
  taught?: boolean;
  assessed?: boolean;
}

export interface GenerateSchemeInput {
  curriculumId: string;
  classId: string;
  termId: string;
}
