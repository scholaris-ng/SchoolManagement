import { lazy } from 'react';
import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { SiteLayout } from './site-layout';

/**
 * The public school website, mounted at `/s/:slug`.
 *
 * It sits outside the authenticated shell and is code-split away from it: a
 * prospective parent reading the admissions page never downloads the bursar's
 * invoicing screens, and a signed-in bursar never downloads this.
 */

const SiteHomePage = lazy(() =>
  import('./pages/home-page').then((m) => ({ default: m.SiteHomePage })),
);
const SiteAboutPage = lazy(() =>
  import('./pages/about-page').then((m) => ({ default: m.SiteAboutPage })),
);
const SiteSchoolsPage = lazy(() =>
  import('./pages/schools-page').then((m) => ({ default: m.SiteSchoolsPage })),
);
const SiteProgrammePage = lazy(() =>
  import('./pages/programme-page').then((m) => ({ default: m.SiteProgrammePage })),
);
const SiteAcademicsPage = lazy(() =>
  import('./pages/academics-page').then((m) => ({ default: m.SiteAcademicsPage })),
);
const SiteAdmissionsPage = lazy(() =>
  import('./pages/admissions-page').then((m) => ({ default: m.SiteAdmissionsPage })),
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
    { path: 'schools', element: <SiteSchoolsPage /> },
    { path: 'schools/:programme', element: <SiteProgrammePage /> },
    { path: 'academics', element: <SiteAcademicsPage /> },
    { path: 'admissions', element: <SiteAdmissionsPage /> },
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
