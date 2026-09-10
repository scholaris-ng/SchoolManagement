import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * The dashboard and the analytics screens built on it.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage })),
);
const RetentionPage = lazy(() =>
  import('@/features/analytics/retention-page').then((m) => ({ default: m.RetentionPage })),
);

export const analyticsRoutes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },

  {
    element: guarded('analytics.read'),
    children: [{ path: 'analytics', element: <AnalyticsPage /> }],
  },
  {
    element: guarded('analytics.retention'),
    children: [{ path: 'analytics/retention', element: <RetentionPage /> }],
  },
];
