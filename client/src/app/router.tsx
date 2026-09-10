import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './layouts/app-shell';
import { RequireAuth } from '@/components/guards/permission-gate';
import { analyticsRoutes } from './routes/analytics.routes';
import { peopleRoutes } from './routes/people.routes';
import { teachingRoutes } from './routes/teaching.routes';
import { assessmentRoutes } from './routes/assessment.routes';
import { financeRoutes } from './routes/finance.routes';
import { behaviourRoutes } from './routes/behaviour.routes';
import { communicationRoutes } from './routes/communication.routes';
import { administrationRoutes } from './routes/administration.routes';
import { portalRoutes } from './routes/portal.routes';

/**
 * The route tree.
 *
 * Public routes and the authenticated shell live here; everything below the
 * shell is composed from one module per product area in `./routes`, each owning
 * its own lazy page imports. That keeps this file about the *shape* of the app
 * rather than an inventory of every screen in it.
 *
 * Every page below the shell is code-split: a parent on a phone downloads the
 * dashboard and their children's results, not the bursar's invoicing screens.
 * `AppShell` already provides the Suspense boundary these lazy chunks need.
 *
 * Route-level `RequirePermission` (via `guarded`) mirrors the sidebar's
 * filtering so a deep-linked or bookmarked URL refuses cleanly instead of
 * rendering a page whose every request then 403s. The API remains the
 * authority (spec section 5).
 */

/* -- Public ---------------------------------------------------------------- */
const SignInPage = lazy(() =>
  import('@/features/auth/sign-in-page').then((m) => ({ default: m.SignInPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })),
);
const VerifyPage = lazy(() =>
  import('@/features/public/verify-page').then((m) => ({ default: m.VerifyPage })),
);
const SchoolWebsitePage = lazy(() =>
  import('@/features/public/school-website-page').then((m) => ({ default: m.SchoolWebsitePage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/onboarding-page').then((m) => ({ default: m.OnboardingPage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/errors/not-found-page').then((m) => ({ default: m.NotFoundPage })),
);

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/verify/:code', element: <VerifyPage /> },
  { path: '/s/:slug', element: <SchoolWebsitePage /> },
  { path: '/onboarding', element: <OnboardingPage /> },

  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      ...analyticsRoutes,
      ...peopleRoutes,
      ...teachingRoutes,
      ...assessmentRoutes,
      ...financeRoutes,
      ...behaviourRoutes,
      ...communicationRoutes,
      ...administrationRoutes,
      ...portalRoutes,

      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);
