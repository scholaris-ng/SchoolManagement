import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * School settings, roles, the public website and the audit log.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Administration -------------------------------------------------------- */
const SchoolSettingsPage = lazy(() =>
  import('@/features/settings/school-settings-page').then((m) => ({
    default: m.SchoolSettingsPage,
  })),
);
const AcademicsSettingsPage = lazy(() =>
  import('@/features/settings/academics-settings-page').then((m) => ({
    default: m.AcademicsSettingsPage,
  })),
);
const GradingSettingsPage = lazy(() =>
  import('@/features/settings/grading-settings-page').then((m) => ({
    default: m.GradingSettingsPage,
  })),
);
const RolesSettingsPage = lazy(() =>
  import('@/features/settings/roles-settings-page').then((m) => ({ default: m.RolesSettingsPage })),
);
const WebsiteSettingsPage = lazy(() =>
  import('@/features/settings/website-settings-page').then((m) => ({
    default: m.WebsiteSettingsPage,
  })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/audit-page').then((m) => ({ default: m.AuditPage })),
);

/* -- Parent portal & profile ----------------------------------------------- */

export const administrationRoutes: RouteObject[] = [
  {
    element: guarded('academics.manage'),
    children: [{ path: 'settings/academics', element: <AcademicsSettingsPage /> }],
  },
  {
    element: guarded('grading.manage'),
    children: [{ path: 'settings/grading', element: <GradingSettingsPage /> }],
  },
  {
    element: guarded('role.manage'),
    children: [{ path: 'settings/roles', element: <RolesSettingsPage /> }],
  },
  {
    element: guarded('settings.manage'),
    children: [
      { path: 'settings', element: <SchoolSettingsPage /> },
      { path: 'settings/website', element: <WebsiteSettingsPage /> },
    ],
  },
  {
    element: guarded('audit.read'),
    children: [{ path: 'audit', element: <AuditPage /> }],
  },
];
