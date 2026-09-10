import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '../../config/env';

/**
 * Firebase Admin — lazy singleton behind a synchronous credential guard.
 *
 * The guard is not optional. `applicationDefault()` with no credential source
 * available fails inside the SDK's gRPC channel setup, on a promise that is not
 * part of the awaited call chain: Node reports it as an unhandled rejection and
 * kills the process, even when the call site is wrapped in try/catch. Failing
 * synchronously here — before the SDK is touched — is what makes normal error
 * handling around Firebase calls actually work.
 * (`ai_agent_flow_firebase.md` sections 4.1 and 7.2.)
 */

let app: App | null = null;
let auth: Auth | null = null;

/**
 * `gcloud auth application-default login` writes here. The Google auth library
 * reads this path even with GOOGLE_APPLICATION_CREDENTIALS unset.
 */
function hasLocalAdcFile(): boolean {
  const base =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA ?? '', 'gcloud')
      : path.join(os.homedir(), '.config', 'gcloud');
  try {
    return fs.existsSync(path.join(base, 'application_default_credentials.json'));
  } catch {
    return false;
  }
}

function hasExplicitServiceAccount(): boolean {
  return Boolean(
    env.firebase.serviceAccountJson ||
      (env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey),
  );
}

/**
 * `K_SERVICE` is set on Cloud Run and Firebase App Hosting. The metadata-server
 * credential path only genuinely works there, never on a developer machine.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    hasExplicitServiceAccount() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      hasLocalAdcFile(),
  );
}

export function getFirebaseApp(): App {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase Admin is not configured — set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY), or run where Application Default Credentials are available.',
    );
  }
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  app = initializeApp({
    credential: resolveCredential(),
    projectId: env.firebase.projectId || undefined,
    storageBucket: env.firebase.storageBucket || undefined,
  });
  return app;
}

function resolveCredential() {
  if (env.firebase.serviceAccountJson) {
    return cert(JSON.parse(env.firebase.serviceAccountJson));
  }
  if (env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey) {
    return cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    });
  }
  return applicationDefault();
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}
