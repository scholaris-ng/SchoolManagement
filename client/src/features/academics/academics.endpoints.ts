import { http } from '@/lib/http';
import type {
  AcademicSession,
  House,
  Room,
  SchoolClass,
  SchoolLevel,
  Subject,
  Term,
} from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';

/** Type aliases so these keep the implicit index signature the transport needs. */
export type ClassQuery = {
  levelId?: string;
  includeInactive?: boolean;
  formTeacherOnly?: boolean;
};

export type SubjectQuery = { levelId?: string; classId?: string };

/** A session may be created together with its terms in one call. */
export type SessionPayload = Partial<AcademicSession> & { terms?: Partial<Term>[] };

/**
 * Endpoint layer for the academic structure: sessions, terms, levels, classes,
 * subjects, houses, rooms and timetable periods.
 *
 * Nothing here is hardcoded. A Nigerian school defines Creche → SSS 3, a
 * British-curriculum school defines Reception → Year 11, and the same screens
 * serve both (research feature 15).
 */
export const AcademicsEndpoints = {
  /* -- Reads ---------------------------------------------------------------- */

  fetchSessions: () => http.get<AcademicSession[]>('/academics/sessions'),

  fetchTerms: (sessionId?: string) =>
    http.get<Term[]>('/academics/terms', { query: { sessionId } }),

  fetchLevels: () => http.get<SchoolLevel[]>('/academics/levels'),

  fetchClasses: (query: ClassQuery) =>
    http.get<SchoolClass[]>('/academics/classes', { query }),

  fetchClass: (classId: string) => http.get<SchoolClass>(`/academics/classes/${classId}`),

  fetchSubjects: (query: SubjectQuery) =>
    http.get<Subject[]>('/academics/subjects', { query }),

  fetchRooms: () => http.get<Room[]>('/academics/rooms'),

  fetchHouses: () => http.get<House[]>('/academics/houses'),

  fetchPeriods: () => http.get<TimetablePeriod[]>('/academics/periods'),

  /* -- Writes --------------------------------------------------------------- */

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

  createSubject: (values: Partial<Subject>) => http.post<Subject>('/academics/subjects', values),

  updateSubject: (id: string, values: Partial<Subject>) =>
    http.patch<Subject>(`/academics/subjects/${id}`, values),

  removeSubject: (id: string) => http.delete<void>(`/academics/subjects/${id}`),

  createHouse: (values: Partial<House>) => http.post<House>('/academics/houses', values),

  updateHouse: (id: string, values: Partial<House>) =>
    http.patch<House>(`/academics/houses/${id}`, values),

  createRoom: (values: Partial<Room>) => http.post<Room>('/academics/rooms', values),

  updateRoom: (id: string, values: Partial<Room>) =>
    http.patch<Room>(`/academics/rooms/${id}`, values),

  createPeriod: (values: Partial<TimetablePeriod>) =>
    http.post<TimetablePeriod>('/academics/periods', values),

  updatePeriod: (id: string, values: Partial<TimetablePeriod>) =>
    http.patch<TimetablePeriod>(`/academics/periods/${id}`, values),

  removePeriod: (id: string) => http.delete<void>(`/academics/periods/${id}`),
};
