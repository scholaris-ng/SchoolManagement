import type { SchemeStatus } from '../entities/schemeOfWork.entity';
import type { LessonNoteStatus } from '../entities/lessonNote.entity';

/** Wire shapes, mirroring `SchemeOfWork`, `SchemeWeek` and `LessonNote` in `client/src/types/curriculum.ts`. */

export interface SchemeWeekDTO {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  topicId: string | null;
  topicTitle: string;
  objectiveIds: string[];
  objectiveStatements: string[];
  activities: string | null;
  resources: string | null;
  isBreak: boolean;
}

export interface SchemeOfWorkDTO {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  termId: string;
  termName: string;
  sessionName: string;
  curriculumId: string;
  status: SchemeStatus;
  weeks: SchemeWeekDTO[];
  createdById: string;
  createdByName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  version: number;
}

/** The list omits the weeks; only the detail view needs them. */
export interface SchemeSummaryDTO extends Omit<SchemeOfWorkDTO, 'weeks'> {
  weeks: [];
  weekCount: number;
}

export interface LessonNoteDTO {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  schemeId: string;
  schemeWeekId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  weekNumber: number;
  date: string;
  topic: string;
  objectiveIds: string[];
  objectiveStatements: string[];
  content: string;
  resources: string | null;
  assignment: string | null;
  challenges: string | null;
  studentDifficulties: string | null;
  status: LessonNoteStatus;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  version: number;
}
