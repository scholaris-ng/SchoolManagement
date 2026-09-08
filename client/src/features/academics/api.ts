import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
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
    queryFn: () => http.get<AcademicSession[]>('/academics/sessions'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useTerms(sessionId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.terms(schoolId, sessionId),
    queryFn: () => http.get<Term[]>('/academics/terms', { query: { sessionId } }),
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
    queryFn: () => http.get<SchoolLevel[]>('/academics/levels'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useClasses(query: { levelId?: string; includeInactive?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.classes(schoolId, query),
    queryFn: () => http.get<SchoolClass[]>('/academics/classes', { query }),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

export function useClass(classId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.classDetail(schoolId, classId ?? ''),
    queryFn: () => http.get<SchoolClass>(`/academics/classes/${classId}`),
    enabled: Boolean(schoolId && classId),
  });
}

export function useSubjects(query: { levelId?: string; classId?: string } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.subjects(schoolId, query),
    queryFn: () => http.get<Subject[]>('/academics/subjects', { query }),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

export function useRooms() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.rooms(schoolId),
    queryFn: () => http.get<Room[]>('/academics/rooms'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useHouses() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.houses(schoolId),
    queryFn: () => http.get<House[]>('/academics/houses'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

/** The school day's shape — the grid the timetable is built on. */
export function usePeriods() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.academics.periods(schoolId),
    queryFn: () => http.get<TimetablePeriod[]>('/academics/periods'),
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
  return useAcademicMutation<
    { id?: string; values: Partial<AcademicSession> & { terms?: Partial<Term>[] } },
    AcademicSession
  >({
    request: ({ id, values }) =>
      id
        ? http.patch<AcademicSession>(`/academics/sessions/${id}`, values)
        : http.post<AcademicSession>('/academics/sessions', values),
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
      id ? http.patch<Term>(`/academics/terms/${id}`, values) : http.post<Term>('/academics/terms', values),
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
    request: (termId) => http.post<Term>(`/academics/terms/${termId}/set-current`),
    invalidate: (schoolId) => [queryKeys.all(schoolId)],
    successMessage: 'Current term updated',
  });
}

export function useDeleteSession() {
  return useAcademicMutation<string, void>({
    request: (id) => http.delete<void>(`/academics/sessions/${id}`),
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
      id
        ? http.patch<SchoolLevel>(`/academics/levels/${id}`, values)
        : http.post<SchoolLevel>('/academics/levels', values),
    invalidate: (schoolId) => [
      queryKeys.academics.levels(schoolId),
      queryKeys.academics.classes(schoolId),
    ],
    successMessage: 'Level saved',
  });
}

export function useDeleteLevel() {
  return useAcademicMutation<string, void>({
    request: (id) => http.delete<void>(`/academics/levels/${id}`),
    invalidate: (schoolId) => [queryKeys.academics.levels(schoolId)],
    successMessage: 'Level removed',
  });
}

export function useSaveClass() {
  return useAcademicMutation<{ id?: string; values: Partial<SchoolClass> }, SchoolClass>({
    request: ({ id, values }) =>
      id
        ? http.patch<SchoolClass>(`/academics/classes/${id}`, values)
        : http.post<SchoolClass>('/academics/classes', values),
    invalidate: (schoolId) => [
      queryKeys.academics.classes(schoolId),
      queryKeys.academics.levels(schoolId),
    ],
    successMessage: 'Class saved',
  });
}

export function useDeleteClass() {
  return useAcademicMutation<string, void>({
    request: (id) => http.delete<void>(`/academics/classes/${id}`),
    invalidate: (schoolId) => [queryKeys.academics.classes(schoolId)],
    successMessage: 'Class removed',
  });
}

export function useSaveSubject() {
  return useAcademicMutation<{ id?: string; values: Partial<Subject> }, Subject>({
    request: ({ id, values }) =>
      id
        ? http.patch<Subject>(`/academics/subjects/${id}`, values)
        : http.post<Subject>('/academics/subjects', values),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject saved',
  });
}

export function useDeleteSubject() {
  return useAcademicMutation<string, void>({
    request: (id) => http.delete<void>(`/academics/subjects/${id}`),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject removed',
  });
}

export function useSaveHouse() {
  return useAcademicMutation<{ id?: string; values: Partial<House> }, House>({
    request: ({ id, values }) =>
      id
        ? http.patch<House>(`/academics/houses/${id}`, values)
        : http.post<House>('/academics/houses', values),
    invalidate: (schoolId) => [queryKeys.academics.houses(schoolId)],
    successMessage: 'House saved',
  });
}

export function useSaveRoom() {
  return useAcademicMutation<{ id?: string; values: Partial<Room> }, Room>({
    request: ({ id, values }) =>
      id ? http.patch<Room>(`/academics/rooms/${id}`, values) : http.post<Room>('/academics/rooms', values),
    invalidate: (schoolId) => [queryKeys.academics.rooms(schoolId)],
    successMessage: 'Room saved',
  });
}

export function useSavePeriod() {
  return useAcademicMutation<{ id?: string; values: Partial<TimetablePeriod> }, TimetablePeriod>({
    request: ({ id, values }) =>
      id
        ? http.patch<TimetablePeriod>(`/academics/periods/${id}`, values)
        : http.post<TimetablePeriod>('/academics/periods', values),
    // A new or retimed period changes what the timetable grid can show.
    invalidate: (schoolId) => [queryKeys.academics.periods(schoolId), queryKeys.timetable.list(schoolId)],
    successMessage: 'Period saved',
  });
}

export function useDeletePeriod() {
  return useAcademicMutation<string, void>({
    request: (id) => http.delete<void>(`/academics/periods/${id}`),
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

export function useSubjectOptions(query: { levelId?: string; classId?: string } = {}): SelectOption[] {
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
