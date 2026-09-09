import { defineConfig } from 'cypress';

/**
 * E2E configuration.
 *
 * `baseUrl` points at the app started with `npm run dev:e2e`, which loads
 * `.env.e2e`. That mode proxies `/api` to a dead local port on purpose: a
 * request a spec forgot to stub is refused instantly rather than reaching a
 * real API or database. See `cypress/README.md`.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    retries: { runMode: 2, openMode: 0 },
    // The app is a SPA behind a router; nothing here needs a long default.
    defaultCommandTimeout: 8000,
    requestTimeout: 8000,
  },
});
