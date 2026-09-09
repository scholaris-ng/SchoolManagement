import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import { TimetableEndpoints } from './timetable.endpoints';
import type { SaveEntryInput, TimetableQuery } from './timetable.endpoints';

export type { SaveEntryInput, TimetableQuery };

export function useCurrentTimetable(query: TimetableQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [...queryKeys.timetable.list(schoolId), query],
    queryFn: () => TimetableEndpoints.fetchCurrent(query),
    enabled: Boolean(schoolId),
  });
}

/** Places a lesson on the grid. Clash detection happens server-side. */
export function useSaveTimetableEntry(timetableId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveEntryInput) => TimetableEndpoints.saveEntry(timetableId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timetable.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success('Timetable updated');
    },
  });
}

export function useDeleteTimetableEntry(timetableId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => TimetableEndpoints.removeEntry(timetableId, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timetable.list(schoolId) });
      toast.success('Lesson removed from the timetable');
    },
  });
}

/**
 * Wipes every lesson from the timetable. There is no undo, which is why the
 * button that calls this sits behind a typed confirmation rather than a click.
 */
export function useClearTimetable(timetableId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => TimetableEndpoints.clearEntries(timetableId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timetable.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success('Timetable cleared');
    },
  });
}
