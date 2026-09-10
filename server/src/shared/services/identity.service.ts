import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError';
import { env } from '../../config/env';
import { getFirebaseAuth, isFirebaseConfigured } from '../../infrastructure/firebase/firebaseAdmin';

/**
 * The identity provider abstraction (ARCHITECTURE.md — `IdentityProvider`).
 *
 * Registration needs to *create* a credential, which is the one thing the
 * verify-a-token path never does. Putting it behind an interface keeps the
 * registration service free of Firebase, and lets the flow run end to end
 * before a Firebase project exists.
 */
export interface CreateIdentityInput {
  email: string;
  password: string;
  displayName: string;
}

export interface IdentityProvider {
  readonly kind: 'firebase' | 'dev';
  createUser(input: CreateIdentityInput): Promise<{ uid: string }>;
  /** Compensating action when provisioning fails after the credential exists. */
  deleteUser(uid: string): Promise<void>;
  markEmailVerified(uid: string): Promise<void>;
}

class FirebaseIdentityProvider implements IdentityProvider {
  readonly kind = 'firebase' as const;

  async createUser(input: CreateIdentityInput): Promise<{ uid: string }> {
    try {
      const record = await getFirebaseAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        // Proved by our own code flow, not by Firebase's email link.
        emailVerified: false,
      });
      return { uid: record.uid };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/email-already-exists') {
        throw AppError.conflict('An account with that email address already exists.');
      }
      if (code === 'auth/invalid-password') {
        throw AppError.validation('That password is too weak.');
      }
      console.error('[identity] Firebase createUser failed:', error);
      throw AppError.internal('Could not create the account.');
    }
  }

  async deleteUser(uid: string): Promise<void> {
    await getFirebaseAuth().deleteUser(uid);
  }

  async markEmailVerified(uid: string): Promise<void> {
    await getFirebaseAuth().updateUser(uid, { emailVerified: true });
  }
}

/**
 * Development stand-in, used only when Firebase is unconfigured and
 * `DEV_AUTH_ENABLED` is on.
 *
 * It holds no password at all — it cannot, and must not pretend to. Sign-in in
 * that mode goes through the `mock-token:<email>` path, which authenticates
 * nobody; this exists so the registration and verification flow can be built
 * and exercised before a Firebase project is provisioned.
 */
class DevIdentityProvider implements IdentityProvider {
  readonly kind = 'dev' as const;

  async createUser(input: CreateIdentityInput): Promise<{ uid: string }> {
    console.warn(
      `[identity] Firebase is not configured — created a development identity for ${input.email} with NO password. Sign in with a mock token.`,
    );
    return { uid: `dev:${randomUUID()}` };
  }

  async deleteUser(): Promise<void> {
    // Nothing external was created, so there is nothing to undo.
  }

  async markEmailVerified(): Promise<void> {
    // Verification is tracked on our own user row in this mode.
  }
}

/**
 * Chosen once at startup. Production always resolves to Firebase, because
 * `DEV_AUTH_ENABLED` cannot be set there — `config/env.ts` refuses to boot.
 */
export function getIdentityProvider(): IdentityProvider {
  if (isFirebaseConfigured()) return new FirebaseIdentityProvider();
  if (env.devAuthEnabled) return new DevIdentityProvider();
  throw AppError.internal('Account creation is not configured on this server.');
}
