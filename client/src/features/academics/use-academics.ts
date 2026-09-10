import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import { AcademicsEndpoints } from './academics.endpoints';
import type { ClassQuery, SubjectQuery } from './academics.endpoints';

/**
 * Reads of the academic structure: sessions, terms, levels, classes, subjects,
 * houses, rooms and periods.
 *
 * Nothing here is hardcoded. A Nigerian school defines Creche → SSS 3, a
 * British-curriculum school defines Reception → Year 11, and the same screens
 * serve both (research feature 15).
 */

export function useAcademicSessions() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.sessions(schoolId),
    queryFn: () => AcademicsEndpoints.fetchSessions(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useTerms(sessionId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.terms(schoolId, sessionId),
    queryFn: () => AcademicsEndpoints.fetchTerms(sessionId),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

/** The term everything defaults to — score entry, attendance, invoices. */
export function useCurrentTerm() {
  const terms = useTerms();
  return {
    ...terms,
    data: terms.data?.find((term) => term.isCurrent) ?? terms.data?.[0],
  };
}

export function useLevels() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.levels(schoolId),
    queryFn: () => AcademicsEndpoints.fetchLevels(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useClasses(query: ClassQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.classes(schoolId, query),
    queryFn: () => AcademicsEndpoints.fetchClasses(query),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

export function useClass(classId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.classDetail(schoolId, classId ?? ''),
    queryFn: () => AcademicsEndpoints.fetchClass(classId ?? ''),
    enabled: Boolean(schoolId && classId),
  });
}

export function useSubjects(query: SubjectQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.subjects(schoolId, query),
    queryFn: () => AcademicsEndpoints.fetchSubjects(query),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

export function useRooms() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.rooms(schoolId),
    queryFn: () => AcademicsEndpoints.fetchRooms(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useHouses() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.houses(schoolId),
    queryFn: () => AcademicsEndpoints.fetchHouses(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

/** The school day's shape — the grid the timetable is built on. */
export function usePeriods() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.periods(schoolId),
    queryFn: () => AcademicsEndpoints.fetchPeriods(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}
