import { z } from 'zod';

/**
 * Environment access is centralised and validated once at module load, so a
 * misconfigured deployment fails loudly at startup instead of producing
 * confusing runtime behaviour deep inside a feature.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true' || v === '1'));

const schema = z.object({
  MODE: z.string(),
  PROD: z.boolean(),
  DEV: z.boolean(),
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
  VITE_APP_URL: z.string().default(''),
  VITE_USE_MOCK_API: booleanish.default(false),
  VITE_USE_MOCK_AUTH: booleanish.default(false),
  VITE_USE_LIVE_ENDPOINTS: booleanish.default(true),
  VITE_DEMO_MODE: booleanish.default(false),
  VITE_FIREBASE_API_KEY: z.string().default(''),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().default(''),
  VITE_FIREBASE_PROJECT_ID: z.string().default(''),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().default(''),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().default(''),
  VITE_FIREBASE_APP_ID: z.string().default(''),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().default(''),
  VITE_FIREBASE_VAPID_KEY: z.string().default(''),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid client environment configuration:\n${issues}`);
}

const raw = parsed.data;

/**
 * Mocks are a development affordance and must never reach a real school.
 *
 * The one deliberate exception is a *demo* build: a deployment that exists to
 * show the product before the API is live, running entirely on seeded fictional
 * data. It has to be asked for explicitly at build time (`VITE_DEMO_MODE`), it
 * cannot be switched on from the browser, and the UI says so on every screen —
 * so it can never be mistaken for, or quietly become, a production deployment.
 */
const isDemoBuild = raw.VITE_DEMO_MODE;
const mockingAllowed = !raw.PROD || isDemoBuild;

export const env = {
  mode: raw.MODE,
  isProduction: raw.PROD,
  isDevelopment: raw.DEV,
  apiBaseUrl: raw.VITE_API_BASE_URL,
  appUrl: raw.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  isDemo: isDemoBuild,
  // A demo build has no API to talk to, so mocking is implied rather than
  // configured separately — otherwise the deployment is just a broken portal.
  useMockApi: isDemoBuild || (mockingAllowed && raw.VITE_USE_MOCK_API),
  useMockAuth: isDemoBuild || (mockingAllowed && raw.VITE_USE_MOCK_AUTH),
  /**
   * While the API is built in phases, endpoints that exist for real are let
   * through to the server and the rest stay mocked (`src/mocks/live-routes.ts`).
   *
   * Never in a demo build: that deployment has no API behind it, so a
   * passthrough would be a broken screen rather than a real one. Set
   * `VITE_USE_LIVE_ENDPOINTS=false` to go back to fully mocked, which is what
   * you want when working on the interface with no server running.
   */
  useLiveEndpoints: !isDemoBuild && raw.VITE_USE_LIVE_ENDPOINTS,
  firebase: {
    apiKey: raw.VITE_FIREBASE_API_KEY,
    authDomain: raw.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: raw.VITE_FIREBASE_PROJECT_ID,
    storageBucket: raw.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: raw.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: raw.VITE_FIREBASE_APP_ID,
    measurementId: raw.VITE_FIREBASE_MEASUREMENT_ID,
  },
  vapidKey: raw.VITE_FIREBASE_VAPID_KEY,
} as const;

/** True when the Firebase web config is complete enough to initialise. */
export const isFirebaseConfigured =
  Boolean(env.firebase.apiKey) && Boolean(env.firebase.projectId) && Boolean(env.firebase.appId);
