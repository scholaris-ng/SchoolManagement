import 'reflect-metadata';
import { FieldValue, getFirestore, isFirestoreConfigured } from './firestoreClient';
import { isFirebaseConfigured } from './firebaseAdmin';
import { env } from '../../config/env';

/**
 * Functional verification of the Firestore setup
 * (`ai_agent_flow_firebase.md` section 6.5).
 *
 * "The API returned 200" is not verification. This proves the real
 * write → read-back → delete path works through the same client the
 * application uses, credential guard included, and cleans up after itself so
 * no test document is left behind.
 *
 * Run with `npm run firebase:verify -w @school/api`.
 */
const COLLECTION = '_verification';

async function main(): Promise<void> {
  console.info('Firestore verification');
  console.info('  project :', env.firebase.projectId ?? '(from credentials)');

  // Step 1 — the synchronous credential guard (section 4.1). Without this, a
  // missing credential kills the process from inside the SDK rather than
  // rejecting the call.
  if (!isFirebaseConfigured() || !isFirestoreConfigured()) {
    throw new Error(
      'Not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, or run where Application Default Credentials exist.',
    );
  }
  console.info('  guard   : credentials detected');

  const db = getFirestore();

  // Step 2 — write.
  const ref = await db.collection(COLLECTION).add({
    note: 'Scholaris setup verification. Safe to delete.',
    createdAt: FieldValue.serverTimestamp(),
  });
  console.info('  write   : OK', ref.id);

  // Step 3 — read back. A write that cannot be read proves nothing.
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Wrote a document but could not read it back.');
  console.info('  read    : OK', JSON.stringify(snapshot.data()?.note));

  // Step 4 — remove it completely. Test data must not survive the test.
  await ref.delete();
  const afterDelete = await ref.get();
  if (afterDelete.exists) throw new Error('Document still present after delete.');
  console.info('  delete  : OK');

  console.info('Verified end-to-end.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
