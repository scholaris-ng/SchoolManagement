import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Curriculum,
  CurriculumCoverage,
  CurriculumTopic,
  LearningObjective,
  LessonNote,
  SchemeOfWork,
} from '@/types/curriculum';

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

/**
 * Endpoint layer for curricula, schemes of work and lesson notes.
 *
 * `generateScheme` produces a *draft* from the curriculum and the term's real
 * teaching weeks — explicitly a starting point the teacher reorders and edits
 * before submitting (spec §14). `markCoverage` is the entry point for coverage
 * analytics: the server enforces that an objective cannot be assessed without
 * being taught, so unmarking "taught" clears "assessed" with it (spec §13).
 */
export const CurriculumEndpoints = {
  /* -- Curricula ------------------------------------------------------------ */

  fetchAll: (query: CurriculumQuery) => http.get<Curriculum[]>('/curricula', { query }),

  create: (values: Partial<Curriculum>) => http.post<Curriculum>('/curricula', values),

  update: (id: string, values: Partial<Curriculum>) =>
    http.patch<Curriculum>(`/curricula/${id}`, values),

  remove: (id: string) => http.delete<void>(`/curricula/${id}`),

  /* -- Topics and objectives ------------------------------------------------ */

  fetchTopics: (curriculumId: string) =>
    http.get<CurriculumTopic[]>(`/curricula/${curriculumId}/topics`),

  createTopic: (curriculumId: string, values: Partial<CurriculumTopic>) =>
    http.post<CurriculumTopic>(`/curricula/${curriculumId}/topics`, values),

  updateTopic: (curriculumId: string, id: string, values: Partial<CurriculumTopic>) =>
    http.patch<CurriculumTopic>(`/curricula/${curriculumId}/topics/${id}`, values),

  removeTopic: (curriculumId: string, topicId: string) =>
    http.delete<void>(`/curricula/${curriculumId}/topics/${topicId}`),

  createObjective: (curriculumId: string, topicId: string, values: Partial<LearningObjective>) =>
    http.post<LearningObjective>(
      `/curricula/${curriculumId}/topics/${topicId}/objectives`,
      values,
    ),

  updateObjective: (
    curriculumId: string,
    topicId: string,
    id: string,
    values: Partial<LearningObjective>,
  ) =>
    http.patch<LearningObjective>(
      `/curricula/${curriculumId}/topics/${topicId}/objectives/${id}`,
      values,
    ),

  removeObjective: (curriculumId: string, topicId: string, objectiveId: string) =>
    http.delete<void>(`/curricula/${curriculumId}/topics/${topicId}/objectives/${objectiveId}`),

  /* -- Coverage ------------------------------------------------------------- */

  fetchCoverage: (query: CoverageQuery) =>
    http.get<CurriculumCoverage>('/curriculum-coverage', { query }),

  markCoverage: (curriculumId: string, input: MarkCoverageInput) =>
    http.post<{ updated: number }>(`/curricula/${curriculumId}/coverage`, input),

  /* -- Schemes of work ------------------------------------------------------ */

  fetchSchemes: (query: ListQuery) => http.get<Paginated<SchemeSummary>>('/schemes', { query }),

  fetchScheme: (id: string) => http.get<SchemeOfWork>(`/schemes/${id}`),

  generateScheme: (input: GenerateSchemeInput) =>
    http.post<SchemeOfWork>('/schemes/generate', input),

  updateScheme: (id: string, values: Partial<SchemeOfWork>, version: number) =>
    http.patch<SchemeOfWork>(`/schemes/${id}`, values, { version }),

  /* -- Lesson notes --------------------------------------------------------- */

  fetchLessonNotes: (query: ListQuery) =>
    http.get<Paginated<LessonNote>>('/lesson-notes', { query }),

  fetchLessonNote: (id: string) => http.get<LessonNote>(`/lesson-notes/${id}`),

  createLessonNote: (values: Partial<LessonNote>) =>
    http.post<LessonNote>('/lesson-notes', values),

  updateLessonNote: (id: string, values: Partial<LessonNote>, version?: number) =>
    http.patch<LessonNote>(`/lesson-notes/${id}`, values, { version }),

  removeLessonNote: (id: string) => http.delete<void>(`/lesson-notes/${id}`),

  bulkDeleteLessonNotes: (ids: string[]) =>
    http.post<{ deleted: number }>('/lesson-notes/bulk-delete', { ids }),
};
