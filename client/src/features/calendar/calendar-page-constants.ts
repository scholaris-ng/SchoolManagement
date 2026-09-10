import type { CalendarEvent } from '@/types/curriculum';

/** Fixed option lists shared by `calendar-page` and its parts. */

export const CATEGORIES: CalendarEvent['category'][] = [
  'HOLIDAY',
  'EXAM',
  'TEST',
  'PTA',
  'EVENT',
  'FEE_DEADLINE',
  'ADMISSION',
  'STAFF',
];

export const AUDIENCES: CalendarEvent['audience'][] = [
  'EVERYONE',
  'STAFF',
  'PARENTS',
  'STUDENTS',
  'CLASSES',
];
