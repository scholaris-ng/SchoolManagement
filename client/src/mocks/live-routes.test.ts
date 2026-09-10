import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { env } from '@/lib/env';
import { LIVE_ROUTES, createLiveRouteHandlers, liveRouteHandlers, toUrl } from './live-routes';

/**
 * The passthrough seam between the mock API and the real one.
 *
 * These assertions protect the ways it breaks silently: a path built against
 * the wrong base so it never matches, a live handler registered after a mock
 * for the same path (the mock wins and the screen quietly keeps using fake
 * data), and passthrough leaking into the test run itself.
 *
 * The route table is kept in step with the server by
 * `npm run check:live-routes -w @school/api`, which diffs it against Express's
 * real route table. This file checks the wiring, not the contents.
 */

/** MSW keeps the matcher on each handler's `info`. */
function pathOf(handler: ReturnType<typeof createLiveRouteHandlers>[number]): string {
  return String((handler as unknown as { info: { path: unknown } }).info.path);
}

describe('live route table', () => {
  it('covers every endpoint the API implements today', () => {
    expect(LIVE_ROUTES).toHaveLength(67);
  });

  it('has no duplicate method and path pairs', () => {
    const keys = LIVE_ROUTES.map(([method, path]) => `${method} ${path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not claim endpoints the server has not implemented', () => {
    // Listing a route here before the server implements it turns that screen
    // into a 404 for every user. Update these as each phase lands — the
    // authoritative check is `npm run check:live-routes -w @school/api`.
    const paths = LIVE_ROUTES.map(([, path]) => path);
    expect(paths).not.toContain('/attendance/register'); // phase 2, not yet
    expect(paths).not.toContain('/invoices'); // phase 3
    expect(paths).not.toContain('/curricula'); // phase 4
  });
});

describe('URL construction', () => {
  it('puts versioned routes under the API base', () => {
    expect(toUrl('/academics/levels')).toBe(`${env.apiBaseUrl}/academics/levels`);
    expect(toUrl('/academics/terms/:id/set-current')).toBe(
      `${env.apiBaseUrl}/academics/terms/:id/set-current`,
    );
  });

  it('leaves the health checks alone — they sit outside the version prefix', () => {
    expect(toUrl('/api/health/live')).toBe('/api/health/live');
    expect(toUrl('/api/health/ready')).toBe('/api/health/ready');
  });

  it('produces a matcher for every route', () => {
    const paths = createLiveRouteHandlers().map(pathOf);
    expect(paths).toHaveLength(LIVE_ROUTES.length);
    expect(paths).toContain('/api/v1/academics/levels');
    expect(paths).toContain('/api/health/live');
  });
});

describe('test-environment safety', () => {
  it('is disabled during tests', () => {
    // vite.config.ts pins VITE_USE_LIVE_ENDPOINTS=false for the test run. Without
    // it, every spec under src/mocks tries to reach a server that is not
    // running and fails inside MSW's passthrough.
    expect(env.useLiveEndpoints).toBe(false);
    expect(liveRouteHandlers).toHaveLength(0);
  });
});

describe('handler ordering', () => {
  it('spreads the live handlers before the mock handlers', () => {
    // Asserted against the source because the composed array is empty in tests.
    // MSW resolves in order, so moving this spread below the mocks would leave
    // every screen silently on fake data with nothing failing.
    // A path from the project root, not `import.meta.url`: under jsdom that is
    // an http: URL, and `readFileSync` rejects it.
    const source = readFileSync(
      resolve(process.cwd(), 'src/mocks/handlers/index.ts'),
      'utf8',
    );
    const live = source.indexOf('...liveRouteHandlers');
    const firstMock = source.indexOf('...coreHandlers');

    expect(live, '...liveRouteHandlers should be spread into handlers').toBeGreaterThan(-1);
    expect(firstMock).toBeGreaterThan(-1);
    expect(live).toBeLessThan(firstMock);
  });
});
