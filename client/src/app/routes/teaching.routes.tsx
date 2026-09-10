import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Attendance, the timetable, curricula, schemes of work and lesson notes.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Teaching -------------------------------------------------------------- */
const AttendancePage = lazy(() =>
  import('@/features/attendance/attendance-page').then((m) => ({ default: m.AttendancePage })),
);
const TimetablePage = lazy(() =>
  import('@/features/timetable/timetable-page').then((m) => ({ default: m.TimetablePage })),
);
const CurriculumListPage = lazy(() =>
  import('@/features/curriculum/curriculum-list-page').then((m) => ({
    default: m.CurriculumListPage,
  })),
);
const CurriculumDetailPage = lazy(() =>
  import('@/features/curriculum/curriculum-detail-page').then((m) => ({
    default: m.CurriculumDetailPage,
  })),
);
const SchemesPage = lazy(() =>
  import('@/features/curriculum/schemes-page').then((m) => ({ default: m.SchemesPage })),
);
const SchemeDetailPage = lazy(() =>
  import('@/features/curriculum/scheme-detail-page').then((m) => ({ default: m.SchemeDetailPage })),
);
const LessonNotesPage = lazy(() =>
  import('@/features/curriculum/lesson-notes-page').then((m) => ({ default: m.LessonNotesPage })),
);
const LessonNoteFormPage = lazy(() =>
  import('@/features/curriculum/lesson-note-form-page').then((m) => ({
    default: m.LessonNoteFormPage,
  })),
);
const CalendarPage = lazy(() =>
  import('@/features/calendar/calendar-page').then((m) => ({ default: m.CalendarPage })),
);

/* -- Assessment ------------------------------------------------------------ */

export const teachingRoutes: RouteObject[] = [
  {
    element: guarded('attendance.read'),
    children: [{ path: 'attendance', element: <AttendancePage /> }],
  },
  {
    element: guarded('timetable.read'),
    children: [{ path: 'timetable', element: <TimetablePage /> }],
  },
  {
    element: guarded('curriculum.read'),
    children: [
      { path: 'curriculum', element: <CurriculumListPage /> },
      { path: 'curriculum/:id', element: <CurriculumDetailPage /> },
    ],
  },
  {
    element: guarded('scheme.read'),
    children: [
      { path: 'schemes', element: <SchemesPage /> },
      { path: 'schemes/:id', element: <SchemeDetailPage /> },
    ],
  },
  {
    element: guarded('lessonnote.read'),
    children: [
      { path: 'lesson-notes', element: <LessonNotesPage /> },
      { path: 'lesson-notes/new', element: <LessonNoteFormPage /> },
      { path: 'lesson-notes/:id', element: <LessonNoteFormPage /> },
    ],
  },
  {
    element: guarded('calendar.read'),
    children: [{ path: 'calendar', element: <CalendarPage /> }],
  },
];
