import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { PickupPerson } from '@/types/people';
import { StudentEndpoints } from './students.endpoints';
import type { StudentAttendanceRange } from './students.endpoints';

/** A child's record across the other modules: attendance, fees, behaviour,
 * results and who may collect them. */

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
