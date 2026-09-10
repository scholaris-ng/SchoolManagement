import { http } from '@/lib/http';
import type { Curriculum, CurriculumCoverage, CurriculumTopic, LearningObjective } from '@/types/curriculum';
import type { CurriculumQuery, CoverageQuery, MarkCoverageInput } from './curriculum.types';

/**
 * Endpoints for curricula, their topics and their learning objectives.
 *
 * `markCoverage` is the entry point for coverage analytics: the server enforces
 * that an objective cannot be assessed without being taught, so unmarking
 * "taught" clears "assessed" with it (spec §13).
 */
export const CurriculaEndpoints = {
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
};
