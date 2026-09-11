import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/feedback';
import type { Permission } from '@/types/rbac';
import type { AuthenticatedUser, SchoolMembership } from '@/types/tenant';

/**
 * Shared test harness.
 *
 * Pages are rendered with the same providers they get in the app, minus the
 * identity plumbing: tests that care about permissions supply them directly
 * rather than driving a sign-in.
 */

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Retries turn an expected error state into a multi-second timeout.
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function buildMembership(over: Partial<SchoolMembership> = {}): SchoolMembership {
  return {
    id: 'mem_1',
    schoolId: 'sch_1',
    schoolName: 'Brightfield Academy',
    schoolShortName: 'Brightfield',
    schoolSlug: 'brightfield',
    roles: ['SCHOOL_ADMIN'],
    customRoleNames: [],
    permissions: [],
    branding: { primaryColor: '#4f46e5', accentColor: '#0ea5e9' },
    status: 'ACTIVE',
    ...over,
  };
}

export interface RenderPageOptions {
  /** Initial address; use with `path` for pages that read route params. */
  route?: string;
  /** Route pattern the element is mounted at, e.g. `/family/:studentId`. */
  path?: string;
  /**
   * Mount under a data router. Required by pages that use `UnsavedChangesGuard`,
   * because `useBlocker` exists only there.
   *
   * It is not the default: under a memory *data* router in jsdom,
   * `setSearchParams` does not actually navigate, which silently breaks every
   * assertion about list state — and list state lives in the URL throughout
   * this app. `MemoryRouter` behaves correctly, so it is the default.
   */
  dataRouter?: boolean;
  queryClient?: QueryClient;
}

export function renderPage(
  ui: ReactElement,
  {
    route = '/',
    path,
    dataRouter = false,
    queryClient = testQueryClient(),
  }: RenderPageOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const routed = dataRouter ? (
    <RouterProvider
      router={createMemoryRouter([{ path: path ?? '*', element: ui }], {
        initialEntries: [route],
      })}
    />
  ) : (
    <MemoryRouter initialEntries={[route]}>
      {path ? (
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      ) : (
        ui
      )}
    </MemoryRouter>
  );

  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{routed}</TooltipProvider>
    </QueryClientProvider>,
  );

  return Object.assign(result, { queryClient });
}

/**
 * The shape `vi.mock('@/app/providers/auth-provider')` needs to return.
 * `can` is the real evaluator's behaviour, so a test that grants
 * `analytics.read` sees exactly what such a user would.
 */
export function authStub(permissions: Permission[], over: Record<string, unknown> = {}) {
  const membership = buildMembership({ permissions });
  const can = (requirement?: unknown): boolean => {
    if (!requirement) return true;
    const held = new Set<string>(permissions);
    const has = (permission: string) => held.has(permission) || held.has('platform.manage');
    if (typeof requirement === 'string') return has(requirement);
    if (Array.isArray(requirement)) return requirement.some(has);
    const object = requirement as { anyOf?: string[]; allOf?: string[] };
    if (object.anyOf) return object.anyOf.some(has);
    if (object.allOf) return object.allOf.every(has);
    return false;
  };

  return {
    status: 'authenticated' as const,
    identityUser: {
      uid: 'uid_1',
      email: 'ada@brightfield.edu.ng',
      displayName: 'Adaeze Okonkwo',
      photoUrl: null,
      emailVerified: true,
    },
    // Typed, so a field added to the real user shows up here as an error
    // rather than as `undefined` in whichever screen reads it first.
    user: {
      id: 'usr_1',
      firebaseUid: 'uid_1',
      email: 'ada@brightfield.edu.ng',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      displayName: 'Adaeze Okonkwo',
      phone: null,
      photoUrl: null,
      isPlatformAdmin: false,
      memberships: [membership],
      createdAt: new Date().toISOString(),
    } satisfies AuthenticatedUser as AuthenticatedUser,
    memberships: [membership],
    membership,
    schoolId: membership.schoolId,
    permissions,
    persona: 'admin' as const,
    needsOnboarding: false,
    can,
    switchSchool: () => {},
    signIn: async () => {},
    register: async () => ({ email: "", schoolName: "", expiresInMinutes: 15, emailVerified: false }),
    verifyEmail: async () => {},
    signOut: async () => {},
    changePassword: async () => {},
    refreshSession: async () => {},
    error: null,
    ...over,
  };
}
