import { env } from './env';
import { isFirebaseConfigured } from './firebase';
import { FirebaseIdentityProvider } from './identity-firebase';
import { MockIdentityProvider } from './identity-mock';
import type { IdentityProvider } from './identity.types';

/**
 * Identity provider abstraction (ARCHITECTURE.md — `IdentityProvider` adapter).
 *
 * The rest of the app never imports Firebase Auth directly; it depends on this
 * interface. That keeps the auth provider swappable and lets development run
 * against mock personas with no Firebase project at all.
 */
export type { IdentityProvider, IdentityUser } from './identity.types';

export const identity: IdentityProvider =
  env.useMockAuth || !isFirebaseConfigured
    ? new MockIdentityProvider()
    : new FirebaseIdentityProvider();

export const isMockIdentity = identity.kind === 'mock';
