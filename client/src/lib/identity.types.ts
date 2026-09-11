/**
 * Identity provider abstraction (ARCHITECTURE.md — `IdentityProvider` adapter).
 *
 * The rest of the app never imports Firebase Auth directly; it depends on this
 * interface. That keeps the auth provider swappable and lets development run
 * against mock personas with no Firebase project at all.
 *
 * There is deliberately no password reset here. The provider would send that
 * mail itself, unbranded and outside every rule the other templates follow, so
 * the app asks our own API instead and the link arrives in the Scholaris
 * template. See `POST /auth/forgot-password`.
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
  /**
   * Changes the signed-in user's own password.
   *
   * The current one is required rather than optional: it proves the person at
   * the keyboard is the account holder and not someone who found an unlocked
   * screen. The provider verifies it — the caller cannot, and must not try.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  onAuthChange(callback: (user: IdentityUser | null) => void): () => void;
}
