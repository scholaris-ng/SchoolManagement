import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Students, guardians, staff, admissions and bulk import.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- People ---------------------------------------------------------------- */
const StudentsListPage = lazy(() =>
  import('@/features/students/students-list-page').then((m) => ({ default: m.StudentsListPage })),
);
const StudentFormPage = lazy(() =>
  import('@/features/students/student-form-page').then((m) => ({ default: m.StudentFormPage })),
);
const StudentDetailPage = lazy(() =>
  import('@/features/students/student-detail-page').then((m) => ({ default: m.StudentDetailPage })),
);
const GuardiansListPage = lazy(() =>
  import('@/features/guardians/guardians-list-page').then((m) => ({ default: m.GuardiansListPage })),
);
const GuardianFormPage = lazy(() =>
  import('@/features/guardians/guardian-form-page').then((m) => ({ default: m.GuardianFormPage })),
);
const GuardianDetailPage = lazy(() =>
  import('@/features/guardians/guardian-detail-page').then((m) => ({
    default: m.GuardianDetailPage,
  })),
);
const StaffListPage = lazy(() =>
  import('@/features/staff/staff-list-page').then((m) => ({ default: m.StaffListPage })),
);
const StaffFormPage = lazy(() =>
  import('@/features/staff/staff-form-page').then((m) => ({ default: m.StaffFormPage })),
);
const StaffDetailPage = lazy(() =>
  import('@/features/staff/staff-detail-page').then((m) => ({ default: m.StaffDetailPage })),
);
const AdmissionsListPage = lazy(() =>
  import('@/features/admissions/admissions-list-page').then((m) => ({
    default: m.AdmissionsListPage,
  })),
);
const AdmissionFormPage = lazy(() =>
  import('@/features/admissions/admission-form-page').then((m) => ({
    default: m.AdmissionFormPage,
  })),
);
const AdmissionDetailPage = lazy(() =>
  import('@/features/admissions/admission-detail-page').then((m) => ({
    default: m.AdmissionDetailPage,
  })),
);
const ImportPage = lazy(() =>
  import('@/features/imports/import-page').then((m) => ({ default: m.ImportPage })),
);

/* -- Teaching -------------------------------------------------------------- */

export const peopleRoutes: RouteObject[] = [
  {
    element: guarded('student.create'),
    children: [{ path: 'students/new', element: <StudentFormPage /> }],
  },
  {
    element: guarded('student.update'),
    children: [{ path: 'students/:id/edit', element: <StudentFormPage /> }],
  },
  {
    element: guarded('student.read'),
    children: [
      { path: 'students', element: <StudentsListPage /> },
      { path: 'students/:id', element: <StudentDetailPage /> },
    ],
  },
  {
    element: guarded('guardian.manage'),
    children: [
      { path: 'guardians/new', element: <GuardianFormPage /> },
      { path: 'guardians/:id/edit', element: <GuardianFormPage /> },
    ],
  },
  {
    element: guarded('guardian.read'),
    children: [
      { path: 'guardians', element: <GuardiansListPage /> },
      { path: 'guardians/:id', element: <GuardianDetailPage /> },
    ],
  },
  {
    element: guarded('staff.manage'),
    children: [
      { path: 'staff/new', element: <StaffFormPage /> },
      { path: 'staff/:id/edit', element: <StaffFormPage /> },
    ],
  },
  {
    element: guarded('staff.read'),
    children: [
      { path: 'staff', element: <StaffListPage /> },
      { path: 'staff/:id', element: <StaffDetailPage /> },
    ],
  },
  {
    element: guarded('admission.manage'),
    children: [{ path: 'admissions/new', element: <AdmissionFormPage /> }],
  },
  {
    element: guarded('admission.read'),
    children: [
      { path: 'admissions', element: <AdmissionsListPage /> },
      { path: 'admissions/:id', element: <AdmissionDetailPage /> },
    ],
  },
  {
    element: guarded('import.run'),
    children: [{ path: 'import', element: <ImportPage /> }],
  },
];
