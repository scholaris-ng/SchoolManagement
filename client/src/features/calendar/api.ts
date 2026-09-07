import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { CalendarEvent } from '@/types/curriculum';

export function useCalendarEvents(query: { from?: string; to?: string; category?: string } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.calendar.events(schoolId, query),
    queryFn: () => http.get<CalendarEvent[]>('/calendar', { query }),
    enabled: Boolean(schoolId),
  });
}

export function useSaveCalendarEvent(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<CalendarEvent>) =>
      id
        ? http.patch<CalendarEvent>(`/calendar/${id}`, values)
        : http.post<CalendarEvent>('/calendar', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.admin(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.parent(schoolId) });
      toast.success('Event saved');
    },
  });
}

export function useDeleteCalendarEvent() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => http.delete<void>(`/calendar/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events(schoolId) });
      toast.success('Event removed');
    },
  });
}
