import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Student,
  StudentDocument,
  StudentEnrollment,
  StudentGuardianLink,
  StudentSummary,
  PickupPerson,
  CollectionEvent,
} from '@/types/people';
import type { AttendanceRecord, AttendanceSummary } from '@/types/attendance';
import type { StudentLedgerEntry, StudentFinanceSummary } from '@/types/finance';
import type { BehaviourTermRating } from '@/types/behaviour';
import type { ReportCard } from '@/types/results';
import type { StudentFormValues, PromotionValues, StatusChangeValues } from './schema';

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
    queryFn: () => http.get<Paginated<Student>>('/students', { query }),
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
    queryFn: () => http.get<Student>(`/students/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

/** Typeahead used by the command palette and every student picker. */
export function useStudentSearch(term: string, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.list(schoolId, { search: term, pageSize: 8, mode: 'summary' }),
    queryFn: async () => {
      const result = await http.get<Paginated<StudentSummary>>('/students/search', {
        query: { search: term, pageSize: 8 },
      });
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
    mutationFn: (values: StudentFormValues) => http.post<Student>('/students', values),
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
      // The version travels as If-Match so a concurrent edit is rejected by the
      // server rather than silently overwriting a colleague's change.
      http.patch<Student>(`/students/${id}`, values, { version }),
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
    mutationFn: (values: StatusChangeValues) =>
      http.post<Student>(`/students/${id}/status`, values),
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
    mutationFn: (values: PromotionValues) =>
      http.post<{ promoted: number; repeated: number; graduated: number }>(
        '/students/promotions',
        values,
      ),
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
    queryFn: () => http.get<StudentEnrollment[]>(`/students/${studentId}/enrollments`),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentGuardians(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.guardians(schoolId, studentId ?? ''),
    queryFn: () => http.get<StudentGuardianLink[]>(`/students/${studentId}/guardians`),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useLinkGuardian(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: {
      guardianId: string;
      relationship: string;
      isPrimaryContact: boolean;
      isEmergencyContact: boolean;
      isFinanciallyResponsible: boolean;
      canPickUp: boolean;
    }) => http.post<StudentGuardianLink>(`/students/${studentId}/guardians`, values),
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
    mutationFn: (linkId: string) =>
      http.delete<void>(`/students/${studentId}/guardians/${linkId}`),
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
    queryFn: () => http.get<StudentDocument[]>(`/students/${studentId}/documents`),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useAddStudentDocument(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: {
      name: string;
      category: StudentDocument['category'];
      storagePath: string;
      downloadUrl: string;
      mimeType: string;
      sizeBytes: number;
    }) => http.post<StudentDocument>(`/students/${studentId}/documents`, values),
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
    mutationFn: (documentId: string) =>
      http.delete<void>(`/students/${studentId}/documents/${documentId}`),
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
  range: { from?: string; to?: string; termId?: string },
) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.attendance(schoolId, studentId ?? '', range),
    queryFn: () =>
      http.get<{ summary: AttendanceSummary; records: AttendanceRecord[] }>(
        `/students/${studentId}/attendance`,
        { query: range },
      ),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentLedger(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.ledger(schoolId, studentId ?? ''),
    queryFn: () =>
      http.get<{ summary: StudentFinanceSummary; entries: StudentLedgerEntry[] }>(
        `/students/${studentId}/ledger`,
      ),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentBehaviour(studentId: string | undefined, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.behaviour(schoolId, studentId ?? '', termId),
    queryFn: () =>
      http.get<BehaviourTermRating[]>(`/students/${studentId}/behaviour`, { query: { termId } }),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentResults(studentId: string | undefined, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.results(schoolId, studentId ?? '', termId),
    queryFn: () =>
      http.get<ReportCard>(`/students/${studentId}/results`, { query: { termId } }),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useStudentPickupPersons(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.students.pickupPersons(schoolId, studentId ?? ''),
    queryFn: () =>
      http.get<{ persons: PickupPerson[]; recentEvents: CollectionEvent[] }>(
        `/students/${studentId}/pickup`,
      ),
    enabled: Boolean(schoolId && studentId),
  });
}

export function useSavePickupPerson(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<PickupPerson> }) =>
      id
        ? http.patch<PickupPerson>(`/students/${studentId}/pickup/${id}`, values)
        : http.post<PickupPerson>(`/students/${studentId}/pickup`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.pickupPersons(schoolId, studentId),
      });
      toast.success('Authorised pickup list updated');
    },
  });
}
