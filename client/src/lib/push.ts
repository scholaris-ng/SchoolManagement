import { env, isFirebaseConfigured } from './env';

/**
 * Web push enrolment (spec section 28 — FCM is a delivery *channel*).
 *
 * Nothing here decides what gets sent: the server owns notification records and
 * preferences. This module only answers "may we push to this browser, and what
 * is its token?" so the token can be registered against the user.
 *
 * `firebase/messaging` is imported dynamically so a browser that will never
 * enable push — or a build with no Firebase project — never downloads it.
 */

export type PushSupportState =
  | 'unsupported'
  | 'unconfigured'
  | 'default'
  | 'granted'
  | 'denied';

export function pushSupportState(): PushSupportState {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return 'unsupported';
  }
  if (!isFirebaseConfigured || !env.vapidKey) return 'unconfigured';
  return Notification.permission as 'default' | 'granted' | 'denied';
}

/**
 * The service worker Firebase uses to receive messages while the tab is closed.
 *
 * The web config travels in the query string because a service worker cannot
 * read the bundle's environment. Every one of these values is public by design
 * (they identify the project, they do not authorise anything) — the same values
 * already ship inside the JavaScript bundle.
 */
async function registerMessagingWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    storageBucket: env.firebase.storageBucket,
    messagingSenderId: env.firebase.messagingSenderId,
    appId: env.firebase.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`, {
    scope: '/',
  });
}

/**
 * Asks the browser for permission and returns an FCM token, or `null` if the
 * user declined. Throws only on genuine failures, so the caller can tell
 * "they said no" apart from "something broke".
 */
export async function enablePush(): Promise<string | null> {
  const state = pushSupportState();
  if (state === 'unsupported' || state === 'unconfigured') return null;

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') return null;

  const [{ getMessaging, getToken }, { getFirebaseApp }] = await Promise.all([
    import('firebase/messaging'),
    import('./firebase'),
  ]);

  const app = getFirebaseApp();
  if (!app) return null;

  const registration = await registerMessagingWorker();
  const token = await getToken(getMessaging(app), {
    vapidKey: env.vapidKey,
    serviceWorkerRegistration: registration,
  });

  return token || null;
}

/** Stops this browser receiving pushes. The server keeps the record. */
export async function disablePush(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const { getMessaging, deleteToken } = await import('firebase/messaging');
  const { getFirebaseApp } = await import('./firebase');
  const app = getFirebaseApp();
  if (!app) return;
  await deleteToken(getMessaging(app));
}
