import { lazy } from 'react';
import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { SiteLayout } from './site-layout';

/**
 * The public school website, mounted at `/s/:slug`.
 *
 * The page list mirrors the school's own menu: home, About Us, the two school
 * sections, Events and Contact Us. It sits outside the authenticated shell and
 * is code-split away from it, so a prospective parent reading about the High
 * School never downloads the bursar's invoicing screens.
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

export const siteRoute: RouteObject = {
  path: '/s/:slug',
  element: <SiteLayout />,
  children: [
    { index: true, element: <SiteHomePage /> },
    { path: 'about', element: <SiteAboutPage /> },
    { path: 'schools/:programme', element: <SiteProgrammePage /> },
    { path: 'news-and-events', element: <SiteNewsEventsPage /> },
    { path: 'contact', element: <SiteContactPage /> },
    // An unknown page on a school's site belongs back on that school's home
    // page, not on the application's 404.
    { path: '*', element: <RedirectToSiteHome /> },
  ],
};

function RedirectToSiteHome() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/s/${slug ?? ''}`} replace />;
}
