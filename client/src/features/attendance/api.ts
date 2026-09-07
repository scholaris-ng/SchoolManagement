import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { outbox } from '@/lib/outbox';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type {
  AttendanceMarkInput,
  AttendanceRegister,
  AttendanceTrendPoint,
} from '@/types/attendance';

export interface ClassAttendanceSummaryRow {
  classId: string;
  className: string;
  attendanceRate: number;
  totalDays: number;
}

export function useAttendanceRegister(classId: string | undefined, date: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.register(schoolId, classId ?? '', date),
    queryFn: () =>
      http.get<AttendanceRegister>('/attendance/register', { query: { classId, date } }),
    enabled: Boolean(schoolId && classId && date),
  });
}

export function useAttendanceSummary(query: { classId?: string; from?: string; to?: string } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.summary(schoolId, query),
    queryFn: () => http.get<ClassAttendanceSummaryRow[]>('/attendance/summary', { query }),
    enabled: Boolean(schoolId),
  });
}

export function useAttendanceTrend(query: { classId?: string; days?: number } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.attendance.trend(schoolId, query),
    queryFn: () => http.get<AttendanceTrendPoint[]>('/attendance/trend', { query }),
    enabled: Boolean(schoolId),
  });
}

export interface SaveRegisterInput {
  classId: string;
  className: string;
  date: string;
  marks: AttendanceMarkInput[];
}

export interface SaveRegisterResult {
  saved: number;
  notificationsSent: number;
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
        return await http.post<SaveRegisterResult>('/attendance/register', {
          classId: input.classId,
          date: input.date,
          marks: input.marks,
        });
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
