import { http, HttpResponse } from 'msw';
import { liveRouteHandlers, LIVE_ROUTE_COUNT } from '../live-routes';
import { coreHandlers } from './core';
import { peopleHandlers } from './people';
import { academicsExtraHandlers } from './academics-extra';
import { attendanceResultsHandlers } from './attendance-results';
import { financeHandlers } from './finance';
import { engagementHandlers } from './engagement';
import { dashboardHandlers } from './dashboards';
import { importsHandlers } from './imports';

/**
 * The development API.
 *
 * These handlers exist so the interface can be built, reviewed and demonstrated
 * against realistic data before the Express service is finished. They mirror
 * the response envelope, pagination, permission and tenant-isolation rules the
 * real API is specified to enforce — feature code cannot tell the difference,
 * so switching to the real server is a configuration change, not a rewrite.
 *
 * `env.useMockApi` is forced off in production builds, so none of this can ship.
 */
export const handlers = [
  // FIRST, deliberately. MSW resolves in order, so these decline to mock the
  // endpoints Express really implements and let them reach the server. A mock
  // registered before them would win and the real API would never be called.
  ...liveRouteHandlers,

  ...coreHandlers,
  ...peopleHandlers,
  ...academicsExtraHandlers,
  ...attendanceResultsHandlers,
  ...financeHandlers,
  ...engagementHandlers,
  ...dashboardHandlers,
  ...importsHandlers,

  // Anything under /api that no handler claimed is a bug in the client, not a
  // silent 404 from a passthrough — make it loud during development.
  http.all('/api/*', ({ request }) => {
    const { method, url } = request;
    console.warn(
      `[mock-api] Unhandled ${method} ${url}\n` +
        `  Neither a mock handler nor one of the ${LIVE_ROUTE_COUNT} live routes matched.\n` +
        `  If the server implements this now, add it to src/mocks/live-routes.ts.`,
    );
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `No mock handler for ${method} ${new URL(url).pathname}.`,
        },
      },
      { status: 404 },
    );
  }),
];
