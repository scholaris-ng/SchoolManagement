import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { CalendarEvent } from '@/types/curriculum';
import { CalendarEndpoints } from './calendar.endpoints';
import type { CalendarEventQuery } from './calendar.endpoints';

export type { CalendarEventQuery };

export function useCalendarEvents(query: CalendarEventQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.calendar.events(schoolId, query),
    queryFn: () => CalendarEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
  });
}

export function useSaveCalendarEvent(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<CalendarEvent>) =>
      id ? CalendarEndpoints.update(id, values) : CalendarEndpoints.create(values),
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
    mutationFn: (id: string) => CalendarEndpoints.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events(schoolId) });
      toast.success('Event removed');
    },
  });
}
