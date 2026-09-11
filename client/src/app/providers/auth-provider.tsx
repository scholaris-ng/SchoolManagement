import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { identity, type IdentityUser } from '@/lib/identity';
import {
  AuthEndpoints,
  type RegisterSchoolInput,
  type RegistrationResult,
} from '@/features/auth/auth.endpoints';
import { configureHttp, http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { localStore, storageKeys } from '@/lib/storage';
import { resolvePersona, satisfies, type PermissionRequirement } from '@/lib/permissions';
import type { PersonaKey, Permission } from '@/types/rbac';
import type { AuthenticatedUser, SchoolMembership, SessionPayload } from '@/types/tenant';

/**
 * Session state for the whole app.
 *
 * Two distinct questions are answered here, deliberately separately:
 *   - Firebase answers "who is this?" (the identity provider).
 *   - The API answers "what may they do, in which school?" (memberships).
 *
 * The client never invents permissions; it only mirrors what the server said.
 */
interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  identityUser: IdentityUser | null;
  user: AuthenticatedUser | null;
  memberships: SchoolMembership[];
  membership: SchoolMembership | null;
  schoolId: string | null;
  permissions: Permission[];
  persona: PersonaKey;
  /** True when the user is signed in but has no school membership yet. */
  needsOnboarding: boolean;
  can: (requirement?: PermissionRequirement) => boolean;
  switchSchool: (schoolId: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  register: (values: RegisterSchoolInput) => Promise<RegistrationResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  error: unknown;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const sessionQueryFn = () => http.get<SessionPayload>('/auth/session');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [identityUser, setIdentityUser] = useState<IdentityUser | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() =>
    localStore.get<string | null>(storageKeys.activeSchoolId, null),
  );

  // Wire the transport to this session before any request goes out.
  useEffect(() => {
    configureHttp({
      tokenProvider: () => identity.getIdToken(),
      tenantProvider: () => localStore.get<string | null>(storageKeys.activeSchoolId, null),
      onUnauthorized: () => {
        queryClient.clear();
        void identity.signOut();
      },
    });
  }, [queryClient]);

  useEffect(
    () =>
      identity.onAuthChange((user) => {
        setIdentityUser(user);
        setIdentityReady(true);
        if (!user) {
          localStore.remove(storageKeys.activeSchoolId);
          setActiveSchoolId(null);
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.session(),
    queryFn: sessionQueryFn,
    enabled: identityReady && Boolean(identityUser),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      // A 401/403 means this identity has no session — retrying will not help.
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  const user = sessionQuery.data?.user ?? null;
  const memberships = useMemo(() => user?.memberships ?? [], [user]);

  // Reconcile the remembered school against what the server actually returned:
  // a revoked membership must not keep driving the UI.
  useEffect(() => {
    if (memberships.length === 0) return;
    const valid = memberships.some((entry) => entry.schoolId === activeSchoolId);
    if (!valid) {
      const fallback = sessionQuery.data?.activeSchoolId ?? memberships[0].schoolId;
      localStore.set(storageKeys.activeSchoolId, fallback);
      setActiveSchoolId(fallback);
    }
  }, [memberships, activeSchoolId, sessionQuery.data?.activeSchoolId]);

  const membership = useMemo(
    () => memberships.find((entry) => entry.schoolId === activeSchoolId) ?? memberships[0] ?? null,
    [memberships, activeSchoolId],
  );

  const permissions = useMemo(() => membership?.permissions ?? [], [membership]);
  const persona = useMemo(() => resolvePersona(membership), [membership]);

  const can = useCallback(
    (requirement?: PermissionRequirement) => satisfies(permissions, requirement),
    [permissions],
  );

  const switchSchool = useCallback(
    (schoolId: string) => {
      if (schoolId === activeSchoolId) return;
      localStore.set(storageKeys.activeSchoolId, schoolId);
      localStore.remove(storageKeys.activeChild);
      setActiveSchoolId(schoolId);
      // Cached rows belong to the previous tenant; drop them rather than risk
      // showing one school's data under another's branding.
      queryClient.removeQueries({ queryKey: ['school'] });
    },
    [activeSchoolId, queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await identity.signIn(email, password);
      // Identity only confirms the credentials; a blocked staff membership (on
      // leave, exited) fails here, and the caller needs that error to show it —
      // an `invalidateQueries` alone would fail silently in the background. This
      // is called directly, not through `queryClient.fetchQuery`, so the shared
      // query cache's own `onError` toast doesn't also fire and duplicate the
      // message the sign-in form is about to show inline.
      try {
        const session = await sessionQueryFn();
        queryClient.setQueryData(queryKeys.session(), session);
      } catch (error) {
        await identity.signOut();
        throw error;
      }
    },
    [queryClient],
  );

  /**
   * Registration deliberately does NOT live here.
   *
   * Creating a school means creating a credential, a school, its roles and an
   * administrator membership together, and only the server can do that as one
   * operation. Calling `identity.signUp` from the browser would create a
   * Firebase account first and leave it orphaned if provisioning then failed.
   *
   * `SignUpPage` posts to `/auth/register` instead, and the account stays
   * unusable until the emailed code is entered — so there is no session to
   * establish here and nothing to invalidate.
   */
  const register = useCallback(
    async (values: RegisterSchoolInput) => AuthEndpoints.register(values),
    [],
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    await AuthEndpoints.verifyEmail(email, code);
    // Still no session: the user signs in with the password they just set.
  }, []);

  const signOutUser = useCallback(async () => {
    await identity.signOut();
    localStore.remove(storageKeys.activeSchoolId);
    localStore.remove(storageKeys.activeChild);
    setActiveSchoolId(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.session() });
  }, [queryClient]);

  const status: AuthContextValue['status'] = !identityReady
    ? 'loading'
    : !identityUser
      ? 'unauthenticated'
      : sessionQuery.isPending
        ? 'loading'
        : sessionQuery.isError
          ? 'unauthenticated'
          : 'authenticated';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identityUser,
      user,
      memberships,
      membership,
      schoolId: membership?.schoolId ?? null,
      permissions,
      persona,
      needsOnboarding: status === 'authenticated' && memberships.length === 0,
      can,
      switchSchool,
      signIn,
      register,
      verifyEmail,
      signOut: signOutUser,
      changePassword: (currentPassword: string, newPassword: string) =>
        identity.changePassword(currentPassword, newPassword),
      refreshSession,
      error: sessionQuery.error,
    }),
    [
      status,
      identityUser,
      user,
      memberships,
      membership,
      permissions,
      persona,
      can,
      switchSchool,
      signIn,
      register,
      verifyEmail,
      signOutUser,
      refreshSession,
      sessionQuery.error,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Convenience for the many hooks that need the tenant id for a cache key. */
export function useSchoolId(): string | null {
  return useAuth().schoolId;
}

export function usePermission(requirement?: PermissionRequirement): boolean {
  return useAuth().can(requirement);
}
