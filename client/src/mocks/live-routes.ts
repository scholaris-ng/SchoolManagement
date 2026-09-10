import { http, passthrough } from 'msw';
import { env } from '@/lib/env';

/**
 * Routes the Express API actually implements, which the mock layer must let
 * through to the real server.
 *
 * The backend is being built in phases (spec section 51) while the client is
 * already complete, so for a long stretch some endpoints are real and the rest
 * are not. Without this the choice is all-or-nothing: leave `VITE_USE_MOCK_API`
 * on and never exercise the real API, or turn it off and watch two hundred
 * unimplemented endpoints 404. This list is the seam between the two.
 *
 * **Keep it in step with the server.** A route listed here but not implemented
 * gives the user a 404 from Express; a route implemented but not listed stays
 * silently mocked, which is worse — the screen works, against fake data, and
 * nobody notices the real endpoint was never called. Regenerate with the route
 * dump described in `server/README.md` whenever a module lands.
 *
 * Paths are relative to the API base (`/api/v1`), except the health checks,
 * which sit outside the versioned prefix.
 */
export type LiveRoute = readonly [method: 'get' | 'post' | 'patch' | 'delete', path: string];

export const LIVE_ROUTES: readonly LiveRoute[] = [
  // ─── Health ────────────────────────────────────────────────────────────────
  ['get', '/api/health/live'],
  ['get', '/api/health/ready'],

  // ─── Auth, registration and profile (spec sections 5 and 6) ────────────────
  ['get', '/auth/session'],
  ['post', '/auth/register'],
  ['post', '/auth/verify-email'],
  ['post', '/auth/resend-verification'],
  ['patch', '/users/me'],

  // ─── School settings and the public page (sections 6 and 31) ───────────────
  ['get', '/schools/current'],
  ['patch', '/schools/current'],
  ['get', '/website'],
  ['patch', '/website'],
  ['get', '/public/schools/:slug'],

  // ─── Roles and audit (sections 5 and 33) ───────────────────────────────────
  ['get', '/roles'],
  ['post', '/roles'],
  ['patch', '/roles/:id'],
  ['get', '/audit'],

  // ─── Academic structure (sections 6 and 9) ─────────────────────────────────
  ['get', '/academics/sessions'],
  ['post', '/academics/sessions'],
  ['patch', '/academics/sessions/:id'],
  ['delete', '/academics/sessions/:id'],

  ['get', '/academics/terms'],
  ['post', '/academics/terms'],
  ['patch', '/academics/terms/:id'],
  ['post', '/academics/terms/:id/set-current'],

  ['get', '/academics/levels'],
  ['post', '/academics/levels'],
  ['patch', '/academics/levels/:id'],
  ['delete', '/academics/levels/:id'],

  ['get', '/academics/classes'],
  ['get', '/academics/classes/:id'],
  ['post', '/academics/classes'],
  ['patch', '/academics/classes/:id'],
  ['delete', '/academics/classes/:id'],

  ['get', '/academics/subjects'],
  ['post', '/academics/subjects'],
  ['patch', '/academics/subjects/:id'],
  ['delete', '/academics/subjects/:id'],

  ['get', '/academics/rooms'],
  ['post', '/academics/rooms'],
  ['patch', '/academics/rooms/:id'],

  ['get', '/academics/houses'],
  ['post', '/academics/houses'],
  ['patch', '/academics/houses/:id'],

  ['get', '/academics/periods'],
  ['post', '/academics/periods'],
  ['patch', '/academics/periods/:id'],
  ['delete', '/academics/periods/:id'],

  // ─── Students (spec section 7) ─────────────────────────────────────────────
  // `/students/search` before `/students/:id`, or the literal is read as an id.
  ['get', '/students/search'],
  ['get', '/students'],
  ['get', '/students/:id'],
  ['post', '/students'],
  ['patch', '/students/:id'],
  ['post', '/students/:id/status'],

  // ─── Guardians and the parent portal (section 8) ───────────────────────────
  ['get', '/guardians'],
  ['get', '/guardians/:id/children'],
  ['get', '/guardians/:id'],
  ['post', '/guardians'],
  ['patch', '/guardians/:id'],
  ['post', '/guardians/:guardianId/invite'],

  ['get', '/students/:studentId/guardians'],
  ['post', '/students/:studentId/guardians'],
  ['delete', '/students/:studentId/guardians/:linkId'],

  // ─── Enrolment history, files and promotion (section 13) ───────────────────
  // `/students/promotions` before `/students/:id`, same literal-versus-id rule.
  ['post', '/students/promotions'],
  ['get', '/students/:studentId/enrollments'],
  ['get', '/students/:studentId/documents'],
  ['post', '/students/:studentId/documents'],
  ['delete', '/students/:studentId/documents/:documentId'],
];

/** Health checks are already absolute; everything else hangs off the API base. */
export function toUrl(path: string): string {
  return path.startsWith('/api/') ? path : `${env.apiBaseUrl}${path}`;
}

/**
 * Handlers that decline to mock, so the request reaches the dev server's `/api`
 * proxy and then Express.
 *
 * These must be registered FIRST — MSW resolves in order, and a mock handler
 * for the same path registered earlier would win.
 */
export function createLiveRouteHandlers() {
  return LIVE_ROUTES.map(([method, path]) => http[method](toUrl(path), () => passthrough()));
}

/**
 * Empty when passthrough is off, which is the case in tests and in a demo
 * build — see `env.useLiveEndpoints`.
 */
export const liveRouteHandlers = env.useLiveEndpoints ? createLiveRouteHandlers() : [];

/** Used by the unhandled-request warning to explain what is going on. */
export const LIVE_ROUTE_COUNT = liveRouteHandlers.length;
