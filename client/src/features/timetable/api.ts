import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { Timetable, TimetableEntry, Weekday } from '@/types/curriculum';

export function useCurrentTimetable(
  query: { classId?: string; teacherId?: string; subjectId?: string } = {},
) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [...queryKeys.timetable.list(schoolId), query],
    queryFn: () => http.get<Timetable>('/timetables/current', { query }),
    enabled: Boolean(schoolId),
  });
}

export interface SaveEntryInput {
  entryId?: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string | null;
  periodId: string;
  day: Weekday;
}

/**
 * Placing a lesson on the grid.
 *
 * Clash detection lives on the server: it is the only place that can see every
 * class's timetable at once, so a teacher double-booked across two classes is
 * refused with a message naming the clash rather than silently accepted
 * (spec section 16).
 */
export function useSaveTimetableEntry(timetableId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveEntryInput) =>
      http.post<TimetableEntry>(`/timetables/${timetableId}/entries`, input),
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
    mutationFn: (entryId: string) =>
      http.delete<void>(`/timetables/${timetableId}/entries/${entryId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timetable.list(schoolId) });
      toast.success('Lesson removed from the timetable');
    },
  });
}

/**
 * Wipes every lesson from the timetable — every class, not just whatever the
 * current filters happen to show. There is no undo, which is why the button
 * that calls this sits behind a typed confirmation rather than a plain click.
 */
export function useClearTimetable(timetableId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => http.delete<{ removed: number }>(`/timetables/${timetableId}/entries`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timetable.list(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success('Timetable cleared');
    },
  });
}
