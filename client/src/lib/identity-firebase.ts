import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
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

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      throw translateAuthError(error);
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

