import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { CoGuardianValues } from './schema';
import { GuardianEndpoints } from './guardians.endpoints';

/**
 * Adds a new guardian and attaches them to the children of one already on
 * record — the mother, from the father's page.
 *
 * Two requests per child rather than one new endpoint: the guardian is created,
 * then linked through the same join the student's own "Link a guardian" uses.
 * The links are settled independently so one child failing doesn't hide that
 * the guardian now exists; the ones that didn't take are returned, not thrown,
 * because retrying the whole call would try to create the same person again.
 */
export function useAddCoGuardian() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentIds, relationship, ...rest }: CoGuardianValues) => {
      const {
        isPrimaryContact,
        isEmergencyContact,
        isFinanciallyResponsible,
        canPickUp,
        ...person
      } = rest;

      const guardian = await GuardianEndpoints.create({
        ...person,
        altPhone: '',
        occupation: '',
        address: '',
        grantPortalAccess: false,
      });

      const results = await Promise.allSettled(
        studentIds.map((studentId) =>
          GuardianEndpoints.linkStudent(guardian.id, {
            studentId,
            relationship,
            isPrimaryContact,
            isEmergencyContact,
            isFinanciallyResponsible,
            canPickUp,
          }),
        ),
      );

      const linkedStudentIds = studentIds.filter((_, index) => results[index]?.status === 'fulfilled');
      const failedCount = studentIds.length - linkedStudentIds.length;

      return { guardian, linkedStudentIds, failedCount };
    },
    onSuccess: ({ linkedStudentIds }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.guardians.list(schoolId) });
      for (const studentId of linkedStudentIds) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.students.guardians(schoolId, studentId),
        });
      }
    },
  });
}
