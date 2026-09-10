import { queryKeys } from '@/lib/query-keys';
import type { AcademicSession, SchoolClass, SchoolLevel, Term } from '@/types/academics';
import { AcademicsEndpoints } from './academics.endpoints';
import type { SessionPayload } from './academics.endpoints';
import { useAcademicMutation } from './use-academic-mutation';

/** Writes to the year's shape: sessions, terms, levels and classes. */

export function useSaveSession() {
  return useAcademicMutation<{ id?: string; values: SessionPayload }, AcademicSession>({
    request: ({ id, values }) =>
      id
        ? AcademicsEndpoints.updateSession(id, values)
        : AcademicsEndpoints.createSession(values),
    invalidate: (schoolId) => [
      queryKeys.academics.sessions(schoolId),
      queryKeys.academics.terms(schoolId),
    ],
    successMessage: 'Academic session saved',
  });
}

export function useSaveTerm() {
  return useAcademicMutation<{ id?: string; values: Partial<Term> }, Term>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateTerm(id, values) : AcademicsEndpoints.createTerm(values),
    invalidate: (schoolId) => [queryKeys.academics.terms(schoolId)],
    successMessage: 'Term saved',
  });
}

/**
 * Which term is current drives attendance, score entry, invoicing, the
 * timetable, report cards and every dashboard — there is no fixed list of
 * pages this doesn't touch. Rather than invalidate each of those query keys
 * individually (and miss one, the way the timetable page's own name/term
 * label went stale before this), every cached query for the school is
 * invalidated, so nothing keeps showing the term that just stopped being
 * current.
 */
export function useSetCurrentTerm() {
  return useAcademicMutation<string, Term>({
    request: (termId) => AcademicsEndpoints.setCurrentTerm(termId),
    invalidate: (schoolId) => [queryKeys.all(schoolId)],
    successMessage: 'Current term updated',
  });
}

export function useDeleteSession() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removeSession(id),
    invalidate: (schoolId) => [
      queryKeys.academics.sessions(schoolId),
      queryKeys.academics.terms(schoolId),
    ],
    successMessage: 'Academic session deleted',
  });
}

export function useSaveLevel() {
  return useAcademicMutation<{ id?: string; values: Partial<SchoolLevel> }, SchoolLevel>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateLevel(id, values) : AcademicsEndpoints.createLevel(values),
    invalidate: (schoolId) => [
      queryKeys.academics.levels(schoolId),
      queryKeys.academics.classes(schoolId),
    ],
    successMessage: 'Level saved',
  });
}

export function useDeleteLevel() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removeLevel(id),
    invalidate: (schoolId) => [queryKeys.academics.levels(schoolId)],
    successMessage: 'Level removed',
  });
}

export function useSaveClass() {
  return useAcademicMutation<{ id?: string; values: Partial<SchoolClass> }, SchoolClass>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateClass(id, values) : AcademicsEndpoints.createClass(values),
    invalidate: (schoolId) => [
      queryKeys.academics.classes(schoolId),
      queryKeys.academics.levels(schoolId),
    ],
    successMessage: 'Class saved',
  });
}

export function useDeleteClass() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removeClass(id),
    invalidate: (schoolId) => [queryKeys.academics.classes(schoolId)],
    successMessage: 'Class removed',
  });
}
