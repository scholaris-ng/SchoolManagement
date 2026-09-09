import { ok, apiUrl, paged } from './api';
import { identityFor, sessionFor, TEST_SCHOOL_ID, type TestRole } from './session';
import type { SessionPayload } from '@/types/tenant';

/**
 * Custom commands. Use these rather than reinventing them in a spec — a stub
 * written by hand in one file is a stub that drifts from the envelope.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** The only sanctioned selector style. */
      dataCy(id: string): Chainable<JQuery<HTMLElement>>;
      /** Seeds a stubbed session for `role` and stubs the calls the shell makes. */
      login(role?: TestRole, overrides?: Partial<SessionPayload>): Chainable<void>;
      /** Clears the stubbed session. */
      logout(): Chainable<void>;
      /** Intercepts one `/api/v1` path. */
      interceptApi(
        method: string,
        path: string,
        response: Record<string, unknown>,
        alias?: string,
      ): Chainable<void>;
      /** Stubs the dashboard payloads (`@dashboard`, `@unreadCount`). */
      stubDashboard(role?: TestRole): Chainable<void>;
      /** Waits for the full-page loader to go away. */
      waitForLoader(): Chainable<void>;
      /** Real sign-in against a live API. Live smoke specs only — read-only. */
      loginByApi(email: string, password: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('dataCy', (id: string) => cy.get(`[data-cy="${id}"]`));

Cypress.Commands.add('interceptApi', (method, path, response, alias) => {
  if (alias) {
    cy.intercept({ method: method.toUpperCase(), url: apiUrl(path) }, response).as(alias);
    return;
  }
  cy.intercept({ method: method.toUpperCase(), url: apiUrl(path) }, response);
});

/**
 * Stubs a signed-in session.
 *
 * Two things make the app believe the user is authenticated:
 *   1. `scholaris:mock-persona` in localStorage, which `MockIdentityProvider`
 *      reads to answer "who is this?" without Firebase;
 *   2. a stubbed `GET /auth/session`, which answers "what may they do?".
 *
 * The layout also polls an unread count on every screen, so that is stubbed
 * here too — otherwise every spec would have to remember it.
 */
Cypress.Commands.add('login', (role: TestRole = 'admin', overrides = {}) => {
  const session = sessionFor(role, overrides);

  cy.window({ log: false }).then((win) => {
    win.localStorage.setItem('scholaris:mock-persona', JSON.stringify(identityFor(role)));
    win.localStorage.setItem('scholaris:active-school-id', JSON.stringify(TEST_SCHOOL_ID));
  });

  cy.interceptApi('GET', '/auth/session', { body: ok(session) }, 'session');
  cy.interceptApi(
    'GET',
    '/notifications/unread-count',
    { body: ok({ notifications: 0, messages: 0 }) },
    'unreadCount',
  );
});

Cypress.Commands.add('logout', () => {
  cy.window({ log: false }).then((win) => {
    win.localStorage.removeItem('scholaris:mock-persona');
    win.localStorage.removeItem('scholaris:active-school-id');
  });
});

Cypress.Commands.add('stubDashboard', (role: TestRole = 'admin') => {
  const endpoint =
    role === 'teacher'
      ? '/dashboard/teacher'
      : role === 'parent'
        ? '/dashboard/parent'
        : role === 'student'
          ? '/dashboard/student'
          : role === 'bursar'
            ? '/dashboard/bursar'
            : '/dashboard/admin';

  cy.fixture('dashboard/admin').then((payload) => {
    cy.interceptApi('GET', endpoint, { body: ok(payload) }, 'dashboard');
  });
  cy.interceptApi('GET', '/academics/terms*', { body: ok([]) }, 'terms');
});

Cypress.Commands.add('waitForLoader', () => {
  cy.contains('Loading…').should('not.exist');
});

/**
 * Real sign-in through the API, cached with `cy.session()`.
 *
 * Reserved for `cypress/e2e/live/` — those specs run against a real deployment
 * and must stay strictly read-only. Never call this from a stubbed spec.
 */
Cypress.Commands.add('loginByApi', (email: string, password: string) => {
  cy.session([email], () => {
    cy.visit('/sign-in');
    cy.dataCy('field-email').type(email);
    cy.dataCy('field-password').type(password, { log: false });
    cy.dataCy('sign-in-submit').click();
    cy.location('pathname').should('not.include', '/sign-in');
  });
});

export { paged };
