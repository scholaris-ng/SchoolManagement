import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { Student, StudentSummary } from '@/types/people';
import type { StudentFormValues, PromotionValues, StatusChangeValues } from './schema';
import type { PromotionResult } from './students.types';

/**
 * Endpoints for the student record itself.
 *
 * Writes that take a `version` send it as `If-Match`, so a concurrent edit is
 * rejected by the server rather than silently overwriting a colleague's change.
 */
export const StudentRecordEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<Student>>('/students', { query }),

  fetchById: (id: string) => http.get<Student>(`/students/${id}`),

  /** Typeahead used by the command palette and every student picker. */
  search: (term: string) =>
    http.get<Paginated<StudentSummary>>('/students/search', {
      query: { search: term, pageSize: 8 },
    }),

  create: (values: StudentFormValues) => http.post<Student>('/students', values),

  update: (id: string, values: Partial<StudentFormValues>, version: number) =>
    http.patch<Student>(`/students/${id}`, values, { version }),

  changeStatus: (id: string, values: StatusChangeValues) =>
    http.post<Student>(`/students/${id}/status`, values),

  /** Bulk promotion at the end of a session; runs in one server transaction. */
  promote: (values: PromotionValues) =>
    http.post<PromotionResult>('/students/promotions', values),
};
