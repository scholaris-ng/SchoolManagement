import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { env } from './env';
import { localStore, storageKeys } from './storage';

/**
 * Identity provider abstraction (ARCHITECTURE.md — `IdentityProvider` adapter).
 *
 * The rest of the app never imports Firebase Auth directly; it depends on this
 * interface. That keeps the auth provider swappable and lets development run
 * against mock personas with no Firebase project at all.
 */
export interface IdentityUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  emailVerified: boolean;
}

export interface IdentityProvider {
  readonly kind: 'firebase' | 'mock';
  signIn(email: string, password: string): Promise<IdentityUser>;
  signUp(email: string, password: string, displayName: string): Promise<IdentityUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  onAuthChange(callback: (user: IdentityUser | null) => void): () => void;
}

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

class FirebaseIdentityProvider implements IdentityProvider {
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

/**
 * Development-only provider. It issues an unsigned, clearly-labelled token that
 * the mock API accepts and a real backend would reject, so there is no risk of
 * it being mistaken for a credential.
 */
class MockIdentityProvider implements IdentityProvider {
  readonly kind = 'mock' as const;
  private listeners = new Set<(user: IdentityUser | null) => void>();

  private get current(): IdentityUser | null {
    return localStore.get<IdentityUser | null>(storageKeys.mockPersona, null);
  }

  private setCurrent(user: IdentityUser | null): void {
    if (user) localStore.set(storageKeys.mockPersona, user);
    else localStore.remove(storageKeys.mockPersona);
    this.listeners.forEach((listener) => listener(user));
  }

  async signIn(email: string): Promise<IdentityUser> {
    const user: IdentityUser = {
      uid: `mock-${email.split('@')[0]}`,
      email,
      displayName: email.split('@')[0].replace(/[._]/g, ' '),
      photoUrl: null,
      emailVerified: true,
    };
    this.setCurrent(user);
    return user;
  }

  async signUp(email: string, _password: string, displayName: string): Promise<IdentityUser> {
    const user: IdentityUser = {
      uid: `mock-${email.split('@')[0]}`,
      email,
      displayName,
      photoUrl: null,
      emailVerified: true,
    };
    this.setCurrent(user);
    return user;
  }

  async signOut(): Promise<void> {
    this.setCurrent(null);
  }

  async sendPasswordReset(): Promise<void> {
    /* Nothing to send in development. */
  }

  async getIdToken(): Promise<string | null> {
    const user = this.current;
    return user ? `mock-token:${user.email}` : null;
  }

  onAuthChange(callback: (user: IdentityUser | null) => void): () => void {
    this.listeners.add(callback);
    // Match Firebase's behaviour of emitting the restored session immediately.
    queueMicrotask(() => callback(this.current));
    return () => this.listeners.delete(callback);
  }
}

export const identity: IdentityProvider =
  env.useMockAuth || !isFirebaseConfigured
    ? new MockIdentityProvider()
    : new FirebaseIdentityProvider();

export const isMockIdentity = identity.kind === 'mock';
