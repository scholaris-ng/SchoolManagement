import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { Guardian, StudentGuardianLink } from '@/types/people';
import type { GuardianFormValues, LinkStudentValues } from './schema';

/** Endpoint layer for the guardian module. */
export const GuardianEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<Guardian>>('/guardians', { query }),

  fetchById: (id: string) => http.get<Guardian>(`/guardians/${id}`),

  /** All children linked to one guardian — the basis of the parent portal. */
  fetchChildren: (id: string) => http.get<StudentGuardianLink[]>(`/guardians/${id}/children`),

  create: (values: GuardianFormValues) => http.post<Guardian>('/guardians', values),

  update: (id: string, values: Partial<GuardianFormValues>, version: number) =>
    http.patch<Guardian>(`/guardians/${id}`, values, { version }),

  /**
   * Sends (or resends) the portal invitation. The guardian account is created
   * in Firebase Auth by the server; the client never handles their credentials.
   */
  invite: (guardianId: string) =>
    http.post<{ invited: boolean; email: string }>(`/guardians/${guardianId}/invite`),

  /**
   * Links this guardian to a child from the guardian's own page — the same
   * join the student's "Link a guardian" posts, just reached from the other
   * side, for the moment a guardian turns out to already exist.
   */
  linkStudent: (guardianId: string, { studentId, ...values }: LinkStudentValues) =>
    http.post<StudentGuardianLink>(`/students/${studentId}/guardians`, { guardianId, ...values }),
};
