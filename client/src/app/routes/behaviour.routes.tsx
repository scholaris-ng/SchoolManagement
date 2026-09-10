import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Behaviour, houses, discipline and child collection.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Behaviour & safety ---------------------------------------------------- */
const BehaviourPage = lazy(() =>
  import('@/features/behaviour/behaviour-page').then((m) => ({ default: m.BehaviourPage })),
);
const HousesPage = lazy(() =>
  import('@/features/behaviour/houses-page').then((m) => ({ default: m.HousesPage })),
);
const DisciplineListPage = lazy(() =>
  import('@/features/discipline/discipline-list-page').then((m) => ({
    default: m.DisciplineListPage,
  })),
);
const IncidentFormPage = lazy(() =>
  import('@/features/discipline/incident-form-page').then((m) => ({ default: m.IncidentFormPage })),
);
const IncidentDetailPage = lazy(() =>
  import('@/features/discipline/incident-detail-page').then((m) => ({
    default: m.IncidentDetailPage,
  })),
);
const CollectionPage = lazy(() =>
  import('@/features/collection/collection-page').then((m) => ({ default: m.CollectionPage })),
);

/* -- Communication --------------------------------------------------------- */

export const behaviourRoutes: RouteObject[] = [
  {
    element: guarded('behaviour.read'),
    children: [{ path: 'behaviour', element: <BehaviourPage /> }],
  },
  {
    element: guarded('house.read'),
    children: [{ path: 'houses', element: <HousesPage /> }],
  },
  {
    element: guarded('discipline.manage'),
    children: [{ path: 'discipline/new', element: <IncidentFormPage /> }],
  },
  {
    element: guarded('discipline.read'),
    children: [
      { path: 'discipline', element: <DisciplineListPage /> },
      { path: 'discipline/:id', element: <IncidentDetailPage /> },
    ],
  },
  {
    element: guarded('collection.read'),
    children: [{ path: 'collection', element: <CollectionPage /> }],
  },
];
