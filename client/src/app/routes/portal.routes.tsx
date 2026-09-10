import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

/**
 * The parent portal and every user’s own profile.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Parent portal & profile ----------------------------------------------- */
const FamilyPage = lazy(() =>
  import('@/features/family/family-page').then((m) => ({ default: m.FamilyPage })),
);
const FamilyFinancePage = lazy(() =>
  import('@/features/family/family-finance-page').then((m) => ({ default: m.FamilyFinancePage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const NotificationSettingsPage = lazy(() =>
  import('@/features/profile/notification-settings-page').then((m) => ({
    default: m.NotificationSettingsPage,
  })),
);

export const portalRoutes: RouteObject[] = [
  { path: 'family', element: <FamilyPage /> },
  { path: 'family/finance', element: <FamilyFinancePage /> },
  { path: 'family/:studentId', element: <FamilyPage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'profile/notifications', element: <NotificationSettingsPage /> },
];
