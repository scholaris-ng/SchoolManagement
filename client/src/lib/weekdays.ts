import type { Weekday } from '@/types/curriculum';

/** The school week — Monday to Friday, shared by the timetable grid and anything else that lays out a week. */
export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 'MONDAY', label: 'Monday', short: 'Mon' },
  { value: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { value: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { value: 'FRIDAY', label: 'Friday', short: 'Fri' },
];
