import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outbox } from '@/lib/outbox';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import { AttendanceEndpoints } from './attendance.endpoints';
import type {
  AttendanceSummaryQuery,
  AttendanceTrendQuery,
  ClassAttendanceSummaryRow,
  SaveRegisterInput,
  SaveRegisterResult,
} from './attendance.endpoints';

export type {
  AttendanceSummaryQuery,
  AttendanceTrendQuery,
  ClassAttendanceSummaryRow,
  SaveRegisterInput,
  SaveRegisterResult,
};

export function useAttendanceRegister(classId: string | undefined, date: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.register(schoolId, classId ?? '', date),
    queryFn: () => AttendanceEndpoints.fetchRegister(classId ?? '', date),
    enabled: Boolean(schoolId && classId && date),
  });
}

export function useAttendanceSummary(query: AttendanceSummaryQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.summary(schoolId, query),
    queryFn: () => AttendanceEndpoints.fetchSummary(query),
    enabled: Boolean(schoolId),
  });
}

export function useAttendanceTrend(query: AttendanceTrendQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.trend(schoolId, query),
    queryFn: () => AttendanceEndpoints.fetchTrend(query),
    enabled: Boolean(schoolId),
  });
}

/**
 * Saving a register.
 *
 * Attendance is the workflow most likely to be interrupted by a dead network,
 * and a teacher cannot reconstruct who was absent an hour later. So a failure
 * that looks like connectivity is queued in the durable outbox and replayed —
 * and, crucially, the UI then says "pending sync", never "saved" (spec §39).
 */
export function useSaveRegister() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveRegisterInput): Promise<SaveRegisterResult | 'queued'> => {
      try {
        return await AttendanceEndpoints.saveRegister(input);
      } catch (error) {
        const offline =
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? true
            : (error as { isOffline?: boolean }).isOffline === true;
        if (!offline) throw error;

        outbox.enqueue({
          label: `Attendance — ${input.className}, ${input.date}`,
          method: 'POST',
          path: '/attendance/register',
          body: { classId: input.classId, date: input.date, marks: input.marks },
          // One entry per class per day: re-marking replaces the queued copy
          // instead of stacking up a queue of near-identical writes.
          dedupeKey: `attendance:${input.classId}:${input.date}`,
          schoolId,
          invalidate: [
            queryKeys.attendance.register(schoolId, input.classId, input.date) as string[],
            queryKeys.dashboard.teacher(schoolId) as string[],
          ],
        });
        return 'queued';
      }
    },
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.register(schoolId, input.classId, input.date),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.summary(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.admin(schoolId) });

      if (result === 'queued') {
        toast.warning('Saved on this device only', {
          description: 'You are offline. The register will sync automatically when you reconnect.',
        });
        return;
      }

      toast.success('Register saved', {
        description:
          result.notificationsSent > 0
            ? `${result.notificationsSent} guardian${result.notificationsSent === 1 ? '' : 's'} notified of an absence.`
            : undefined,
      });
    },
  });
}
