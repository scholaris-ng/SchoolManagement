import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { House, Room, Subject } from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import { AcademicsEndpoints } from './academics.endpoints';
import { useAcademicMutation } from './use-academic-mutation';

/** Writes to what a school teaches with: subjects, houses, rooms and periods. */

export function useSaveSubject() {
  return useAcademicMutation<{ id?: string; values: Partial<Subject> }, Subject>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateSubject(id, values) : AcademicsEndpoints.createSubject(values),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject saved',
  });
}

export function useDeleteSubject() {
  return useAcademicMutation<string, { deleted: boolean }>({
    request: (id) => AcademicsEndpoints.removeSubject(id),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    // The confirm dialog already warned which of these was coming — this just
    // confirms it went the way `subject.isReferenced` said it would.
    successMessage: (result) =>
      result.deleted ? 'Subject deleted' : 'Subject archived — it is still in use elsewhere',
  });
}

/**
 * One subject at a time under the hood — `removeSubject` decides per subject
 * whether it is genuinely deleted or archived instead, and a batch of them can
 * land on either side of that line differently. `Promise.allSettled` rather
 * than a dedicated bulk endpoint, the same way `useBulkExitStaff` does it: one
 * subject failing (renamed or referenced differently since the page loaded)
 * must not undo what already succeeded for the rest of the selection.
 */
export function useBulkDeleteSubjects() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => AcademicsEndpoints.removeSubject(id)),
      );
      let deleted = 0;
      let archived = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.deleted) deleted += 1;
          else archived += 1;
        }
      }
      const failed = results.length - deleted - archived;
      return { total: ids.length, deleted, archived, failed };
    },
    onSuccess: ({ deleted, archived, failed }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academics.subjects(schoolId) });

      if (failed > 0 && deleted + archived === 0) {
        toast.error('Could not remove the selected subjects', {
          description: 'They may have changed since this page loaded. Refresh and try again.',
        });
        return;
      }

      // Honest about which of the two happened to each one, the same as the
      // single-subject toast — "removed" would paper over a real difference
      // between a subject that is gone and one that is only hidden.
      const parts: string[] = [];
      if (deleted > 0) parts.push(`${deleted} deleted`);
      if (archived > 0) parts.push(`${archived} archived — still in use elsewhere`);
      const summary = parts.join(', ') || 'Nothing changed';

      if (failed === 0) {
        toast.success(summary);
      } else {
        toast.warning(`${summary}, ${failed} failed`, {
          description: 'Failed subjects may have changed since this page loaded. Refresh and try again.',
        });
      }
    },
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
