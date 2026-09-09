import type { Weekday } from '@/types/curriculum';

/** The school week — Monday to Friday, shared by the timetable grid and anything else that lays out a week. */
export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 'MONDAY', label: 'Monday', short: 'Mon' },
  { value: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { value: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { value: 'FRIDAY', label: 'Friday', short: 'Fri' },
];

/**
 * How many teaching weeks a term's dates cover.
 *
 * Counting Mondays to Fridays rather than dividing the span by seven is what
 * makes a term that starts on a Wednesday come out right: the part-weeks at
 * each end are counted as the days they actually contain. Weekends never
 * count, so a term cannot gain a week by ending on a Saturday.
 *
 * The result is what scheme generation spreads a syllabus across, so it must
 * be at least one week for any valid range. Returns 0 when the dates are
 * missing or the end falls before the start.
 */
export function teachingWeeksBetween(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let weekdays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(1, Math.round(weekdays / 5));
}
