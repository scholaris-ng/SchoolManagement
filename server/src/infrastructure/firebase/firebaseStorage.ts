import { getStorage } from 'firebase-admin/storage';
import { getFirebaseApp, isFirebaseConfigured } from './firebaseAdmin';
import { env } from '../../config/env';

/** Not exported by `firebase-admin/storage` itself — inferred to avoid depending on `@google-cloud/storage` directly. */
type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

/**
 * Server-side object storage for files the school never asked a parent's
 * browser to write directly (spec section 27's receipt evidence).
 *
 * Uploads go through this server rather than straight from the browser to
 * Firebase, using the service account's own credentials rather than a
 * client-side Storage security rule. That is what lets `paymentReceipts`
 * decide who may read an object — a signed URL minted for one caller, on one
 * request — instead of an object anyone with the link can open forever.
 */

let bucket: Bucket | null = null;

function getBucket(): Bucket {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured on this server — set FIREBASE_SERVICE_ACCOUNT_JSON (or the discrete FIREBASE_* variables).',
    );
  }
  if (!env.firebase.storageBucket) {
    throw new Error('FIREBASE_STORAGE_BUCKET is not set — file uploads have nowhere to land.');
  }
  if (bucket) return bucket;
  bucket = getStorage(getFirebaseApp()).bucket(env.firebase.storageBucket);
  return bucket;
}

export interface UploadedObject {
  storagePath: string;
  sizeBytes: number;
}

/** Writes a buffer to storage and hands back the path it landed at. */
export async function uploadObject(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadedObject> {
  const file = getBucket().file(storagePath);
  await file.save(buffer, { contentType, resumable: false });
  return { storagePath, sizeBytes: buffer.length };
}

/**
 * A short-lived, one-time link to read one object.
 *
 * Minted fresh on every read rather than stored: a URL good for years is
 * indistinguishable from a public one, and the row in Postgres — not the
 * URL — is what the API actually checks the caller against.
 */
export async function signedDownloadUrl(storagePath: string, expiresInMs = 15 * 60 * 1000): Promise<string> {
  const [url] = await getBucket().file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMs,
  });
  return url;
}
