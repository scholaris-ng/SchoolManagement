import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Loaded before the schema is read so `.env` participates in validation rather
// than being applied after it.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Centralised, validated configuration (spec section 47).
 *
 * The process refuses to start on invalid configuration rather than failing
 * later at the first request that happens to need a missing value.
 */

const booleanish = z
  .string()
  .optional()
  .transform((value) => value === 'true' || value === '1');

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: csv,

  // Either DATABASE_URL, or the discrete DB_* pair below. Checked in `refine`.
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().optional(),
  DB_USERNAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_SSL: booleanish,
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DB_LOGGING: booleanish,

  // Firebase Admin. Absent in local development, where DEV_AUTH_ENABLED covers
  // identity instead — see shared/middleware/auth.middleware.ts.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  /**
   * Accepts `Bearer mock-token:<email>` and resolves it to that user, matching
   * the client's mock identity provider. Refused outright in production by the
   * refinement below — this is a development affordance, not a feature flag.
   */
  DEV_AUTH_ENABLED: booleanish,

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(20),

  PAYSTACK_SECRET_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.errors
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

const raw = parsed.data;

const hasDiscreteDb = Boolean(raw.DB_HOST && raw.DB_USERNAME && raw.DB_NAME);
if (!raw.DATABASE_URL && !hasDiscreteDb) {
  throw new Error(
    'Invalid environment configuration:\n  - Set DATABASE_URL, or DB_HOST + DB_USERNAME + DB_NAME.',
  );
}

if (raw.NODE_ENV === 'production' && raw.DEV_AUTH_ENABLED) {
  throw new Error(
    'Invalid environment configuration:\n  - DEV_AUTH_ENABLED must be off in production.',
  );
}

/**
 * Newlines survive an .env file as the two characters `\` and `n`; the Admin
 * SDK needs them as real line breaks.
 */
function normalisePrivateKey(key: string | undefined): string | undefined {
  return key?.replace(/\n/g, '\n').replace(/^"|"$/g, '');
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  appUrl: raw.APP_URL,
  apiPrefix: raw.API_PREFIX,
  corsOrigins: raw.CORS_ORIGINS.length > 0 ? raw.CORS_ORIGINS : [raw.APP_URL],

  database: {
    url: raw.DATABASE_URL,
    host: raw.DB_HOST,
    port: raw.DB_PORT ?? 5432,
    username: raw.DB_USERNAME,
    password: raw.DB_PASSWORD,
    name: raw.DB_NAME,
    ssl: raw.DB_SSL,
    poolSize: raw.DB_POOL_SIZE,
    logging: raw.DB_LOGGING,
  },

  firebase: {
    projectId: raw.FIREBASE_PROJECT_ID,
    clientEmail: raw.FIREBASE_CLIENT_EMAIL,
    privateKey: normalisePrivateKey(raw.FIREBASE_PRIVATE_KEY),
    serviceAccountJson: raw.FIREBASE_SERVICE_ACCOUNT_JSON,
    storageBucket: raw.FIREBASE_STORAGE_BUCKET,
  },

  devAuthEnabled: raw.DEV_AUTH_ENABLED,

  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
    authMax: raw.AUTH_RATE_LIMIT_MAX,
  },

  paystack: { secretKey: raw.PAYSTACK_SECRET_KEY },
} as const;

export type Env = typeof env;
