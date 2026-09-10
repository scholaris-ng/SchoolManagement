import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import { StudentEndpoints } from './students.endpoints';
import type { AddStudentDocumentInput, LinkGuardianInput } from './students.endpoints';

/** What hangs off a student record: enrolments, guardians and documents. */

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
