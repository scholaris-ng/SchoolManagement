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
  VITE_USE_MOCK_AUTH: booleanish.default(false),
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

export const env = {
  mode: raw.MODE,
  isProduction: raw.PROD,
  isDevelopment: raw.DEV,
  apiBaseUrl: raw.VITE_API_BASE_URL,
  appUrl: raw.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  // Bypasses Firebase and signs in against a locally-fabricated identity —
  // never in a production build. This exists for the Cypress e2e suite
  // (`cy.login()`), which needs a session it can seed without a real Firebase
  // account; nothing else in the app talks to fake data anymore.
  useMockAuth: !raw.PROD && raw.VITE_USE_MOCK_AUTH,
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
