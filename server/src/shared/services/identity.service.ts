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
  /**
   * A one-time link that lets someone set a new password, or `null` when the
   * address has no credential.
   *
   * Generated rather than sent. The provider would happily mail this itself,
   * but that mail is its own, unbranded and outside every rule in section 22 —
   * so we take the link and send it in our own template. `null` is a normal
   * answer and must not be reported to the caller, or this becomes a way to
   * discover which addresses have accounts.
   */
  generatePasswordResetLink(email: string): Promise<string | null>;
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

  async generatePasswordResetLink(email: string): Promise<string | null> {
    try {
      return await getFirebaseAuth().generatePasswordResetLink(email, {
        // Where the browser lands once the new password is set.
        url: `${env.appUrl}/sign-in`,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/email-not-found') return null;
      console.error('[identity] Firebase generatePasswordResetLink failed:', error);
      throw AppError.internal('Could not prepare a password reset.');
    }
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

  async generatePasswordResetLink(email: string): Promise<string | null> {
    // There is no credential in this mode, so there is no password to reset.
    console.warn(`[identity] Firebase is not configured — no reset link for ${email}.`);
    return null;
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
