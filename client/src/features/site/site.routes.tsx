import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { SiteLayout } from './site-layout';
import { useSite } from './site-context';

/**
 * The public school website.
 *
 * Reached at the tenant's own subdomain where one is configured
 * (`site-host.ts`) — `siteHostRoute`, mounted at `/` with no slug in the path
 * because the host already carries it. Wildcard subdomains need a real,
 * owned domain and DNS to work in production, which isn't set up yet, so
 * `sitePathRoute` keeps the original `/s/:slug` address live on whatever
 * domain the app happens to be served from in the meantime — Vercel's shared
 * `*.vercel.app` domain included. `router.tsx` picks one or the other per
 * request; both render the same page list, which mirrors the school's own
 * menu: home, About Us, the two school sections, Events and Contact Us.
 *
 * The site sits outside the authenticated shell and is code-split away from
 * it either way, so a prospective parent reading about the High School never
 * downloads the bursar's invoicing screens.
 */

const SiteHomePage = lazy(() =>
  import('./pages/home-page').then((m) => ({ default: m.SiteHomePage })),
);
const SiteAboutPage = lazy(() =>
  import('./pages/about-page').then((m) => ({ default: m.SiteAboutPage })),
);
const SiteProgrammePage = lazy(() =>
  import('./pages/programme-page').then((m) => ({ default: m.SiteProgrammePage })),
);
const SiteNewsEventsPage = lazy(() =>
  import('./pages/news-events-page').then((m) => ({ default: m.SiteNewsEventsPage })),
);
const SiteContactPage = lazy(() =>
  import('./pages/contact-page').then((m) => ({ default: m.SiteContactPage })),
);

const siteChildren: RouteObject[] = [
  { index: true, element: <SiteHomePage /> },
  { path: 'about', element: <SiteAboutPage /> },
  { path: 'schools/:programme', element: <SiteProgrammePage /> },
  { path: 'news-and-events', element: <SiteNewsEventsPage /> },
  { path: 'contact', element: <SiteContactPage /> },
  // An unknown page on a school's site belongs back on that school's home
  // page, not on the application's 404.
  { path: '*', element: <RedirectToSiteHome /> },
];

export const siteHostRoute: RouteObject = {
  path: '/',
  element: <SiteLayout />,
  children: siteChildren,
};

export const sitePathRoute: RouteObject = {
  path: '/s/:slug',
  element: <SiteLayout />,
  children: siteChildren,
};

function RedirectToSiteHome() {
  const { path } = useSite();
  return <Navigate to={path('')} replace />;
}
