import { http } from '@/lib/http';
import type { CalendarEvent } from '@/types/curriculum';

/**
 * A type alias rather than an interface so it keeps the implicit index
 * signature the transport's `Record<string, unknown>` query parameter needs.
 */
export type CalendarEventQuery = {
  from?: string;
  to?: string;
  category?: string;
};

/** Endpoint layer for the school calendar. */
export const CalendarEndpoints = {
  fetchAll: (query: CalendarEventQuery) => http.get<CalendarEvent[]>('/calendar', { query }),

  create: (values: Partial<CalendarEvent>) => http.post<CalendarEvent>('/calendar', values),

  update: (id: string, values: Partial<CalendarEvent>) =>
    http.patch<CalendarEvent>(`/calendar/${id}`, values),

  remove: (id: string) => http.delete<void>(`/calendar/${id}`),
};
