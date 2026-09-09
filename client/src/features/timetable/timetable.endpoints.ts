import { http } from '@/lib/http';
import type { Timetable, TimetableEntry, Weekday } from '@/types/curriculum';

/** Type alias so it keeps the implicit index signature the transport query needs. */
export type TimetableQuery = {
  classId?: string;
  teacherId?: string;
  subjectId?: string;
};

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
 * Endpoint layer for the timetable.
 *
 * Clash detection lives on the server: it is the only place that can see every
 * class's timetable at once, so a teacher double-booked across two classes is
 * refused with a message naming the clash rather than silently accepted
 * (spec section 16).
 */
export const TimetableEndpoints = {
  fetchCurrent: (query: TimetableQuery) => http.get<Timetable>('/timetables/current', { query }),

  saveEntry: (timetableId: string, input: SaveEntryInput) =>
    http.post<TimetableEntry>(`/timetables/${timetableId}/entries`, input),

  removeEntry: (timetableId: string, entryId: string) =>
    http.delete<void>(`/timetables/${timetableId}/entries/${entryId}`),

  /** Wipes every lesson from the timetable — every class, not just the filtered view. */
  clearEntries: (timetableId: string) =>
    http.delete<{ removed: number }>(`/timetables/${timetableId}/entries`),
};
