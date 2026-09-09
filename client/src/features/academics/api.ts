import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { SelectOption } from '@/components/ui/input';
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
import { AcademicsEndpoints } from './academics.endpoints';
import type { ClassQuery, SessionPayload, SubjectQuery } from './academics.endpoints';

export type { ClassQuery, SessionPayload, SubjectQuery };

/**
 * Academic structure: sessions, terms, levels, classes, subjects, houses.
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

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

function useAcademicMutation<TInput, TResult>(config: {
  request: (input: TInput) => Promise<TResult>;
  invalidate: (schoolId: string | null) => unknown[][];
  successMessage: string;
}) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: config.request,
    onSuccess: () => {
      config.invalidate(schoolId).forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
      toast.success(config.successMessage);
    },
  });
}

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

export function useSaveSubject() {
  return useAcademicMutation<{ id?: string; values: Partial<Subject> }, Subject>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateSubject(id, values) : AcademicsEndpoints.createSubject(values),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject saved',
  });
}

export function useDeleteSubject() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removeSubject(id),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject removed',
  });
}

export function useSaveHouse() {
  return useAcademicMutation<{ id?: string; values: Partial<House> }, House>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateHouse(id, values) : AcademicsEndpoints.createHouse(values),
    invalidate: (schoolId) => [queryKeys.academics.houses(schoolId)],
    successMessage: 'House saved',
  });
}

export function useSaveRoom() {
  return useAcademicMutation<{ id?: string; values: Partial<Room> }, Room>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateRoom(id, values) : AcademicsEndpoints.createRoom(values),
    invalidate: (schoolId) => [queryKeys.academics.rooms(schoolId)],
    successMessage: 'Room saved',
  });
}

export function useSavePeriod() {
  return useAcademicMutation<{ id?: string; values: Partial<TimetablePeriod> }, TimetablePeriod>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updatePeriod(id, values) : AcademicsEndpoints.createPeriod(values),
    // A new or retimed period changes what the timetable grid can show.
    invalidate: (schoolId) => [
      queryKeys.academics.periods(schoolId),
      queryKeys.timetable.list(schoolId),
    ],
    successMessage: 'Period saved',
  });
}

export function useDeletePeriod() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removePeriod(id),
    invalidate: (schoolId) => [
      queryKeys.academics.periods(schoolId),
      queryKeys.timetable.list(schoolId),
    ],
    successMessage: 'Period deleted',
  });
}

/* -------------------------------------------------------------------------- */
/* Option helpers used by every picker in the product                          */
/* -------------------------------------------------------------------------- */

export function useClassOptions(levelId?: string): SelectOption[] {
  const { data } = useClasses(levelId ? { levelId } : {});
  return (data ?? []).map((schoolClass) => ({
    value: schoolClass.id,
    label: schoolClass.name,
    description: `${schoolClass.levelName} · ${schoolClass.enrolledCount} students`,
  }));
}

export function useSubjectOptions(query: SubjectQuery = {}): SelectOption[] {
  const { data } = useSubjects(query);
  return (data ?? []).map((subject) => ({
    value: subject.id,
    label: subject.name,
    description: subject.code,
  }));
}

export function useLevelOptions(): SelectOption[] {
  const { data } = useLevels();
  return (data ?? []).map((level) => ({ value: level.id, label: level.name }));
}

export function useTermOptions(sessionId?: string): SelectOption[] {
  const { data } = useTerms(sessionId);
  return (data ?? []).map((term) => ({
    value: term.id,
    label: term.name,
    description: term.sessionName,
  }));
}

export function useSessionOptions(): SelectOption[] {
  const { data } = useAcademicSessions();
  return (data ?? []).map((session) => ({
    value: session.id,
    label: session.name,
    description: session.isCurrent ? 'Current session' : undefined,
  }));
}

export function useHouseOptions(): SelectOption[] {
  const { data } = useHouses();
  return (data ?? []).map((house) => ({ value: house.id, label: house.name }));
}
