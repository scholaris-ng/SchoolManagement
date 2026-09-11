import { localStore, storageKeys } from './storage';
import type { IdentityProvider, IdentityUser } from './identity.types';

/**
 * A stand-in identity provider for development, demo builds and the E2E suite.
 *
 * It answers "who is this?" from `localStorage` so the app can run against
 * mock personas with no Firebase project at all.
 */

/**
 * Development-only provider. It issues an unsigned, clearly-labelled token that
 * the mock API accepts and a real backend would reject, so there is no risk of
 * it being mistaken for a credential.
 */
export class MockIdentityProvider implements IdentityProvider {
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

  /**
   * Accepted, but nothing is stored.
   *
   * This provider never held a password to begin with — `signIn` takes any
   * address and believes it — so there is nothing here to verify against and
   * nothing to change. It resolves so the screen behaves the same way in a
   * demo build as it does against Firebase.
   */
  async changePassword(): Promise<void> {
    if (!this.current) throw new Error('You are not signed in.');
    // Said out loud, so nobody demonstrating this build believes a password
    // was checked or stored when neither happened.
    console.warn('[identity:mock] Password change accepted but not stored.');
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
