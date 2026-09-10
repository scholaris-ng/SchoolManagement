import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { LessonNote, SchemeOfWork } from '@/types/curriculum';
import type { GenerateSchemeInput, SchemeSummary } from './curriculum.types';

/**
 * Endpoints for schemes of work and lesson notes.
 *
 * `generateScheme` produces a *draft* from the curriculum and the term's real
 * teaching weeks — explicitly a starting point the teacher reorders and edits
 * before submitting (spec §14).
 */
export const SchemeEndpoints = {
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
