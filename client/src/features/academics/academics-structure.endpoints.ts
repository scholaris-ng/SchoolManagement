import { http } from '@/lib/http';
import type { AcademicSession, SchoolClass, SchoolLevel, Term } from '@/types/academics';
import type { ClassQuery, SessionPayload } from './academics.types';

/**
 * Endpoints for the year's shape: sessions, terms, levels and classes.
 *
 * Nothing here is hardcoded. A Nigerian school defines Creche → SSS 3, a
 * British-curriculum school defines Reception → Year 11, and the same screens
 * serve both (research feature 15).
 */
export const AcademicsStructureEndpoints = {
  fetchSessions: () => http.get<AcademicSession[]>('/academics/sessions'),

  fetchTerms: (sessionId?: string) =>
    http.get<Term[]>('/academics/terms', { query: { sessionId } }),

  fetchLevels: () => http.get<SchoolLevel[]>('/academics/levels'),

  fetchClasses: (query: ClassQuery) =>
    http.get<SchoolClass[]>('/academics/classes', { query }),

  fetchClass: (classId: string) => http.get<SchoolClass>(`/academics/classes/${classId}`),

  createSession: (values: SessionPayload) =>
    http.post<AcademicSession>('/academics/sessions', values),

  updateSession: (id: string, values: SessionPayload) =>
    http.patch<AcademicSession>(`/academics/sessions/${id}`, values),

  removeSession: (id: string) => http.delete<void>(`/academics/sessions/${id}`),

  createTerm: (values: Partial<Term>) => http.post<Term>('/academics/terms', values),

  updateTerm: (id: string, values: Partial<Term>) =>
    http.patch<Term>(`/academics/terms/${id}`, values),

  setCurrentTerm: (termId: string) => http.post<Term>(`/academics/terms/${termId}/set-current`),

  createLevel: (values: Partial<SchoolLevel>) =>
    http.post<SchoolLevel>('/academics/levels', values),

  updateLevel: (id: string, values: Partial<SchoolLevel>) =>
    http.patch<SchoolLevel>(`/academics/levels/${id}`, values),

  removeLevel: (id: string) => http.delete<void>(`/academics/levels/${id}`),

  createClass: (values: Partial<SchoolClass>) =>
    http.post<SchoolClass>('/academics/classes', values),

  updateClass: (id: string, values: Partial<SchoolClass>) =>
    http.patch<SchoolClass>(`/academics/classes/${id}`, values),

  removeClass: (id: string) => http.delete<void>(`/academics/classes/${id}`),
};
