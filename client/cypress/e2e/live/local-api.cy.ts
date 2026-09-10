/**
 * Proves the browser really talks to the Express API, not the mock layer.
 *
 * The client mocks every endpoint and passes through only the ones the server
 * implements (`src/mocks/live-routes.ts`). That seam is invisible from the UI —
 * a screen looks identical whether its data came from PostgreSQL or from
 * `src/mocks/seed.ts` — so the only way to know it works is to assert on a
 * value that exists in one and not the other.
 *
 * The level ladder is that value. The mock seed gives Brightfield
 * Creche / Nursery / Primary / Junior Secondary / Senior Secondary; the server
 * seed gives JSS 1 / JSS 2 / JSS 3 / SSS 1. Seeing the second set means the
 * request reached Express.
 *
 * Opt-in and read-only, per `cypress/e2e/live/README.md`. Requires:
 *   - the API on :4000, migrated and seeded
 *   - the client on :5173 with VITE_USE_LIVE_ENDPOINTS=true
 *   - CYPRESS_LOCAL_API=1
 *
 * Run with: npx cypress run --spec cypress/e2e/live/local-api.cy.ts
 */
const ENABLED = Cypress.env('LOCAL_API');

/** A persona the SERVER seed knows about — the e2e `@e2e.test` users do not exist there. */
const SEEDED_ADMIN = {
  uid: 'seed-admin',
  email: 'admin@brightfield.edu.ng',
  displayName: 'Adaeze Okonkwo',
  photoUrl: null,
  emailVerified: true,
};

/** Only in the server seed. */
const SERVER_LEVELS = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1'];
/** Only in the mock seed — seeing any of these means the request was intercepted. */
const MOCK_ONLY_LEVELS = ['Creche', 'Nursery', 'Junior Secondary'];

describe('Local API passthrough', () => {
  before(function () {
    if (!ENABLED) this.skip();
  });

  beforeEach(() => {
    // Sign in WITHOUT stubbing /auth/session — that is the whole point. The
    // mock identity provider reads this key and mints `mock-token:<email>`,
    // which the server accepts while DEV_AUTH_ENABLED is on.
    cy.visit('/sign-in');
    cy.window({ log: false }).then((win) => {
      win.localStorage.setItem('scholaris:mock-persona', JSON.stringify(SEEDED_ADMIN));
    });
  });

  it('serves the session from Express, not from a mock handler', () => {
    cy.request({
      url: '/api/v1/auth/session',
      headers: { Authorization: `Bearer mock-token:${SEEDED_ADMIN.email}` },
    })
      .its('body')
      .then((body) => {
        expect(body.success, 'session succeeded').to.equal(true);
        expect(body.data.user.email).to.equal(SEEDED_ADMIN.email);
        // The server seed marks these verified; a mock would not carry the field.
        expect(body.data.user.emailVerified).to.equal(true);
        expect(body.data.user.memberships[0].roles).to.include('SCHOOL_ADMIN');
      });
  });

  it('renders the level ladder from PostgreSQL on the academics settings page', () => {
    cy.visit('/settings/academics');

    // The server's ladder.
    SERVER_LEVELS.forEach((name) => {
      cy.contains(name, { timeout: 10000 }).should('be.visible');
    });

    // And definitively not the mock's.
    MOCK_ONLY_LEVELS.forEach((name) => {
      cy.contains(name).should('not.exist');
    });
  });

  it('still mocks endpoints the server has not implemented yet', () => {
    // Students are phase 2. This must come from the mock layer, otherwise the
    // screen would be an error page rather than a register.
    cy.visit('/students');
    cy.dataCy('students-table-row', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });
});
