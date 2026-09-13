import type { BloomLevel } from '../entities/learningObjective.entity';

/** Wire shapes, mirroring `client/src/types/curriculum.ts`. */

export interface CurriculumDTO {
  id: string;
  schoolId: string;
  name: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  sessionId: string;
  sessionName: string;
  description: string | null;
  topicCount: number;
  objectiveCount: number;
  isActive: boolean;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningObjectiveDTO {
  id: string;
  topicId: string;
  /** `topic sequence.objective sequence`, derived at read time. */
  code: string;
  statement: string;
  sequence: number;
  bloomLevel: BloomLevel | null;
  taught: boolean;
  assessed: boolean;
  taughtOn: string | null;
}

export interface CurriculumTopicDTO {
  id: string;
  curriculumId: string;
  title: string;
  description: string | null;
  sequence: number;
  suggestedWeeks: number;
  objectives: LearningObjectiveDTO[];
}

export interface CoverageCellDTO {
  topicId: string;
  topicTitle: string;
  objectiveId: string;
  objectiveCode: string;
  statement: string;
  taught: boolean;
  assessed: boolean;
}

export interface CurriculumCoverageDTO {
  curriculumId: string;
  subjectName: string;
  className: string;
  termName: string;
  totalObjectives: number;
  taughtCount: number;
  assessedCount: number;
  taughtNotAssessed: number;
  neverTaught: number;
  coverageRate: number;
  assessmentRate: number;
  cells: CoverageCellDTO[];
}
