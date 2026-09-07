import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { env, isFirebaseConfigured } from './env';

/**
 * Firebase is initialised lazily and only when it is actually configured, so
 * the app still boots (against the mock backend, or a self-hosted API) on a
 * machine with no Firebase credentials.
 */
let app: FirebaseApp | null = null;

function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!app) app = initializeApp(env.firebase);
  return app;
}

/** Exposed for adapters that are loaded on demand, such as push messaging. */
export function getFirebaseApp(): FirebaseApp | null {
  return getApp();
}

export function getFirebaseAuth(): Auth | null {
  const instance = getApp();
  return instance ? getAuth(instance) : null;
}

export function getFirebaseDb(): Firestore | null {
  const instance = getApp();
  return instance ? getFirestore(instance) : null;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const instance = getApp();
  return instance ? getStorage(instance) : null;
}

export { isFirebaseConfigured };
