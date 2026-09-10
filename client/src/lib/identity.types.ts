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
