import './commands';

/**
 * Global E2E setup.
 *
 * The suite is fully network-stubbed. `.env.e2e` points the dev proxy at a dead
 * port, so an unstubbed `/api/v1` request is refused rather than reaching a
 * real server — but a refused request surfaces as a console error and, in some
 * shapes, an unhandled rejection. Failing the spec on those would hide the real
 * cause (a missing stub) behind a generic error, so the guard below is explicit
 * about what it tolerates.
 */

beforeEach(() => {
  // No test may depend on state a previous one left behind.
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();
});

Cypress.on('uncaught:exception', (error) => {
  // A failed fetch to the dead proxy means a spec forgot a stub. That should
  // fail on the assertion that follows — with a useful message — not here.
  if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(error.message)) return false;
  return true;
});
