import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { PickupPerson } from '@/types/people';
import type { StudentFormValues, PromotionValues, StatusChangeValues } from './schema';
import { StudentEndpoints } from './students.endpoints';
import type {
  AddStudentDocumentInput,
  LinkGuardianInput,
  PromotionResult,
  StudentAttendanceRange,
  StudentAttendanceResult,
  StudentLedgerResult,
  StudentPickupResult,
} from './students.endpoints';

export type {
  AddStudentDocumentInput,
  LinkGuardianInput,
  PromotionResult,
  StudentAttendanceRange,
  StudentAttendanceResult,
  StudentLedgerResult,
  StudentPickupResult,
};

/**
 * Data access for the student module.
 *
 * Every hook is tenant-scoped by construction: the cache key carries the active
 * schoolId and the API resolves the tenant from the session, so a stale cache
 * from a previous school can never be read back into this one.
 */

export function useStudents(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.list(schoolId, query),
    queryFn: () => StudentEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
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

/** Typeahead used by the command palette and every student picker. */
export function useStudentSearch(term: string, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.list(schoolId, { search: term, pageSize: 8, mode: 'summary' }),
    queryFn: async () => {
      const result = await StudentEndpoints.search(term);
      return result.items;
    },
    enabled: Boolean(schoolId) && term.trim().length >= 2 && options.enabled !== false,
    staleTime: 30_000,
  });
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

export function useStudentEnrollments(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.enrollments(schoolId, studentId ?? ''),
    queryFn: () => StudentEndpoints.fetchEnrollments(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentGuardians(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.guardians(schoolId, studentId ?? ''),
    queryFn: () => StudentEndpoints.fetchGuardians(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useLinkGuardian(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LinkGuardianInput) => StudentEndpoints.linkGuardian(studentId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.guardians(schoolId, studentId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      toast.success('Guardian linked to student');
    },
  });
}

export function useUnlinkGuardian(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => StudentEndpoints.unlinkGuardian(studentId, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.guardians(schoolId, studentId),
      });
      toast.success('Guardian unlinked');
    },
  });
}

export function useStudentDocuments(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.documents(schoolId, studentId ?? ''),
    queryFn: () => StudentEndpoints.fetchDocuments(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useAddStudentDocument(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: AddStudentDocumentInput) =>
      StudentEndpoints.addDocument(studentId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.documents(schoolId, studentId),
      });
      toast.success('Document saved');
    },
  });
}

export function useDeleteStudentDocument(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => StudentEndpoints.removeDocument(studentId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.documents(schoolId, studentId),
      });
      toast.success('Document removed');
    },
  });
}

export function useStudentAttendance(
  studentId: string | undefined,
  range: StudentAttendanceRange,
) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.attendance(schoolId, studentId ?? '', range),
    queryFn: () => StudentEndpoints.fetchAttendance(studentId ?? '', range),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentLedger(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.ledger(schoolId, studentId ?? ''),
    queryFn: () => StudentEndpoints.fetchLedger(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentBehaviour(studentId: string | undefined, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.behaviour(schoolId, studentId ?? '', termId),
    queryFn: () => StudentEndpoints.fetchBehaviour(studentId ?? '', termId),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentResults(studentId: string | undefined, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.results(schoolId, studentId ?? '', termId),
    queryFn: () => StudentEndpoints.fetchResults(studentId ?? '', termId),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentPickupPersons(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.pickupPersons(schoolId, studentId ?? ''),
    queryFn: () => StudentEndpoints.fetchPickupPersons(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useSavePickupPerson(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<PickupPerson> }) =>
      id
        ? StudentEndpoints.updatePickupPerson(studentId, id, values)
        : StudentEndpoints.createPickupPerson(studentId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.pickupPersons(schoolId, studentId),
      });
      toast.success('Authorised pickup list updated');
    },
  });
}
