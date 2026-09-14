import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { AppShell } from './layouts/app-shell';
import { AppErrorBoundary } from '@/features/errors/app-error-boundary';
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
import { siteHostRoute, sitePathRoute } from '@/features/site/site.routes';
import { siteSlugFromHost } from '@/features/site/site-host';

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
 *
 * A request that lands on a school's own subdomain (`site-host.ts`) gets a
 * wholly different tree — just the public site, mounted at `/` via
 * `siteHostRoute` — rather than this one with a site route grafted on.
 * That's what spec section 31 means by keeping public content separate from
 * authenticated school data: a visitor on `abschool.scholaris.app` never even
 * has the sign-in screen or the app shell in the bundle's route table to
 * stumble onto. Wildcard subdomains need a real domain and DNS, which isn't
 * set up yet, so `sitePathRoute` (`/s/:slug`) stays in this tree too — the
 * one address that already works on any host, Vercel's shared
 * `*.vercel.app` domain included.
 */

/* -- Public ---------------------------------------------------------------- */
const SignInPage = lazy(() =>
  import('@/features/auth/sign-in-page').then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('@/features/auth/sign-up-page').then((m) => ({ default: m.SignUpPage })),
);
const VerifyEmailPage = lazy(() =>
  import('@/features/auth/verify-email-page').then((m) => ({ default: m.VerifyEmailPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })),
);
const VerifyPage = lazy(() =>
  import('@/features/public/verify-page').then((m) => ({ default: m.VerifyPage })),
);
const OfferPage = lazy(() =>
  import('@/features/public/offer-page').then((m) => ({ default: m.OfferPage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/onboarding-page').then((m) => ({ default: m.OnboardingPage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/errors/not-found-page').then((m) => ({ default: m.NotFoundPage })),
);

/**
 * A pathless wrapper carrying the one `errorElement` every route in the tree
 * falls back to. Without it, an error thrown below — a stale chunk after a
 * new deploy, most commonly — reaches React Router's own generic fallback
 * page instead of `AppErrorBoundary`'s reload-and-recover behaviour.
 */
function withRootErrorBoundary(children: RouteObject[]): RouteObject[] {
  return [{ element: <Outlet />, errorElement: <AppErrorBoundary />, children }];
}

export const router = createBrowserRouter(
  siteSlugFromHost()
    ? withRootErrorBoundary([siteHostRoute])
    : withRootErrorBoundary([
        { path: '/sign-in', element: <SignInPage /> },
        { path: '/sign-up', element: <SignUpPage /> },
        { path: '/verify-email', element: <VerifyEmailPage /> },
        { path: '/forgot-password', element: <ForgotPasswordPage /> },
        { path: '/verify/:code', element: <VerifyPage /> },
        { path: '/offers/:token', element: <OfferPage /> },
        sitePathRoute,
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
      ]),
);
