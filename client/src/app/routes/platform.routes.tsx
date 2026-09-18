import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guardedSubscriptionAdmin } from './guarded';

/** Platform administration — the screens for the people who run the product, not for a school. */
const PlatformSchoolsPage = lazy(() =>
  import('@/features/platform/schools-page').then((m) => ({ default: m.PlatformSchoolsPage })),
);

export const platformRoutes: RouteObject[] = [
  {
    element: guardedSubscriptionAdmin(),
    children: [{ path: 'platform/schools', element: <PlatformSchoolsPage /> }],
  },
];
