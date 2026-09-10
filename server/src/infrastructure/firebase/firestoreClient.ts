import { getFirestore as getFirestoreInstance, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getFirebaseApp, isFirebaseConfigured } from './firebaseAdmin';

/**
 * Firestore, used only as a realtime fan-out layer over conversations and the
 * notification inbox (ARCHITECTURE.md, `ai_agent_flow_firebase.md` section 1).
 *
 * PostgreSQL remains the source of truth. Writes here are server-mediated: the
 * Admin SDK is the only writer, clients hold read-only `onSnapshot` listeners
 * gated by security rules, and every ownership and moderation decision stays in
 * the service layer above rather than being duplicated into rules.
 *
 * Shares `firebaseAdmin`'s credential guard — see the note there on why that
 * check must be synchronous.
 */

let firestore: Firestore | null = null;

export function isFirestoreConfigured(): boolean {
  return isFirebaseConfigured();
}

export function getFirestore(): Firestore {
  if (!isFirestoreConfigured()) {
    throw new Error(
      'Firestore is not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or run where Application Default Credentials are available.',
    );
  }
  if (firestore) return firestore;
  firestore = getFirestoreInstance(getFirebaseApp());
  return firestore;
}

export { FieldValue };
