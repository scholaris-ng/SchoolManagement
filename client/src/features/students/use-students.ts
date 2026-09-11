import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { StudentFormValues, PromotionValues, StatusChangeValues } from './schema';
import { StudentEndpoints } from './students.endpoints';

/**
 * The student record itself: the register, one child, and the writes that
 * change either.
 *
 * Every hook is tenant-scoped by construction: the cache key carries the active
 * schoolId and the API resolves the tenant from the session, so a stale cache
 * from a previous school can never be read back into this one.
 */

/**
 * `enabled` lets a caller hold the register back until it has something to ask
 * for — a class picker with nothing picked yet, say. Passing a page size of
 * zero to mean the same thing does not work: the request still goes, and the
 * API rejects it as the invalid page size it is.
 */
export function useStudents(query: ListQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.list(schoolId, query),
    queryFn: () => StudentEndpoints.fetchAll(query),
    enabled: Boolean(schoolId) && options.enabled !== false,
    // Keeps the previous page visible while the next one loads, so paging a
    // large register does not flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useStudent(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.detail(schoolId, id ?? ''),
    queryFn: () => StudentEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Typeahead used by the command palette and every student picker.
 *
 * Debounces internally so every caller gets it for free — six pickers across
 * the app used to pass every keystroke straight through, firing a live
 * request per character. `isSearching` covers both halves of that wait: the
 * debounce itself, and the request it eventually fires.
 */
export function useStudentSearch(term: string, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  const debouncedTerm = useDebouncedValue(term, 300);
  const query = useQuery({
    queryKey: queryKeys.students.list(schoolId, { search: debouncedTerm, pageSize: 8, mode: 'summary' }),
    queryFn: async () => {
      const result = await StudentEndpoints.search(debouncedTerm);
      return result.items;
    },
    enabled: Boolean(schoolId) && debouncedTerm.trim().length >= 2 && options.enabled !== false,
    staleTime: 30_000,
  });
  return { ...query, isSearching: term.trim() !== debouncedTerm.trim() || query.isFetching };
}

export function useCreateStudent() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: StudentFormValues) => StudentEndpoints.create(values),
    onSuccess: (student) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.admin(schoolId) });
      toast.success('Student added', { description: `${student.fullName} · ${student.admissionNo}` });
    },
  });
}

export function useUpdateStudent(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<StudentFormValues>; version: number }) =>
      StudentEndpoints.update(id, values, version),
    onSuccess: (student) => {
      queryClient.setQueryData(queryKeys.students.detail(schoolId, id), student);
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.list(schoolId) });
      toast.success('Student updated');
    },
  });
}

export function useChangeStudentStatus(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: StatusChangeValues) => StudentEndpoints.changeStatus(id, values),
    onSuccess: (student) => {
      queryClient.setQueryData(queryKeys.students.detail(schoolId, id), student);
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollments(schoolId, id) });
      toast.success('Student status updated');
    },
  });
}

/** Bulk promotion at the end of a session; runs in one server transaction. */
export function usePromoteStudents() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: PromotionValues) => StudentEndpoints.promote(values),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academics.classes(schoolId) });
      toast.success('Promotion complete', {
        description: `${result.promoted} promoted, ${result.repeated} repeated, ${result.graduated} graduated.`,
      });
    },
  });
}
