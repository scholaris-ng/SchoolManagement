import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Messaging, announcements and the news feed.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Communication --------------------------------------------------------- */
const MessagesPage = lazy(() =>
  import('@/features/messaging/messages-page').then((m) => ({ default: m.MessagesPage })),
);
const AnnouncementsPage = lazy(() =>
  import('@/features/announcements/announcements-page').then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const AnnouncementFormPage = lazy(() =>
  import('@/features/announcements/announcement-form-page').then((m) => ({
    default: m.AnnouncementFormPage,
  })),
);
const NewsPage = lazy(() =>
  import('@/features/news/news-page').then((m) => ({ default: m.NewsPage })),
);
const NewsDetailPage = lazy(() =>
  import('@/features/news/news-detail-page').then((m) => ({ default: m.NewsDetailPage })),
);

/* -- Administration -------------------------------------------------------- */

export const communicationRoutes: RouteObject[] = [
  {
    element: guarded('message.read'),
    children: [
      { path: 'messages', element: <MessagesPage /> },
      { path: 'messages/:id', element: <MessagesPage /> },
    ],
  },
  {
    element: guarded('announcement.manage'),
    children: [
      { path: 'announcements/new', element: <AnnouncementFormPage /> },
      { path: 'announcements/:id/edit', element: <AnnouncementFormPage /> },
    ],
  },
  {
    element: guarded('announcement.read'),
    children: [{ path: 'announcements', element: <AnnouncementsPage /> }],
  },
  { path: 'news', element: <NewsPage /> },
  { path: 'news/:id', element: <NewsDetailPage /> },
];
