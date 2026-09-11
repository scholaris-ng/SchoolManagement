import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import type { IdentityProvider, IdentityUser } from './identity.types';

/** The real identity provider, backed by Firebase Authentication. */

function mapFirebaseUser(user: FirebaseUser): IdentityUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
    photoUrl: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

/** Turns Firebase's error codes into something a parent can act on. */
function translateAuthError(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'That email address and password do not match an account.',
    'auth/invalid-email': 'That does not look like a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact your school.',
    'auth/user-not-found': 'That email address and password do not match an account.',
    'auth/wrong-password': 'That email address and password do not match an account.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/email-already-in-use': 'An account already exists with that email address.',
    'auth/weak-password': 'Please choose a password of at least 8 characters.',
    'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection.',
  };
  return new Error(messages[code] ?? 'Sign-in failed. Please try again.');
}

/**
 * The same codes mean something else when changing a password.
 *
 * `auth/wrong-password` during sign-in means "that pair does not match an
 * account"; here the account is not in question and the message has to point
 * at the one box that is actually wrong, or the person retypes everything.
 */
function translateChangePasswordError(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'That is not your current password.',
    'auth/wrong-password': 'That is not your current password.',
    'auth/weak-password': 'Please choose a password of at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    // Firebase refuses a password change on a session that has been open a
    // long time, and the only cure is signing in again.
    'auth/requires-recent-login': 'Please sign out and back in, then change your password.',
    'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection.',
  };
  return new Error(messages[code] ?? 'Could not change your password. Please try again.');
}

export class FirebaseIdentityProvider implements IdentityProvider {
  readonly kind = 'firebase' as const;

  private get auth() {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Authentication is not configured.');
    return auth;
  }

  async signIn(email: string, password: string): Promise<IdentityUser> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      return mapFirebaseUser(credential.user);
    } catch (error) {
      throw translateAuthError(error);
    }
  }

  async signUp(email: string, password: string, displayName: string): Promise<IdentityUser> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      await updateProfile(credential.user, { displayName });
      return mapFirebaseUser(credential.user);
    } catch (error) {
      throw translateAuthError(error);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('You are not signed in.');

    try {
      /*
        Re-authenticating first is what makes this safe, and it is also what
        Firebase requires: it refuses `updatePassword` on a stale session. A
        wrong current password therefore fails here, before anything changes.
      */
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, newPassword);
    } catch (error) {
      throw translateChangePasswordError(error);
    }
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = this.auth.currentUser;
    return user ? user.getIdToken(forceRefresh) : null;
  }

  onAuthChange(callback: (user: IdentityUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => callback(user ? mapFirebaseUser(user) : null));
  }
}

