import { Navigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import type { PermissionRequirement } from '@/lib/permissions';
import { EmptyState } from '@/components/ui/feedback';
import { FullPageLoader } from '@/components/layout/full-page-loader';

/**
 * Conditional rendering by permission.
 *
 * This is presentation only. Everything it hides is also refused by the API,
 * so a user who bypasses it in devtools gains no access to data.
 */
export function PermissionGate({
  require: requirement,
  children,
  fallback = null,
}: {
  require: PermissionRequirement;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(requirement) ? children : fallback}</>;
}

/** Route guard: requires a signed-in user with a school membership. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, needsOnboarding } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader label="Signing you in…" />;
  if (status === 'unauthenticated') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

/**
 * Route guard for the people who may activate schools.
 *
 * Not a permission: it is a list of email addresses in the server's
 * configuration, so it cannot be granted from a school's own roles screen.
 */
export function RequireSubscriptionAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.canManageSubscriptions) return <>{children}</>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Lock />}
        data-cy="access-denied"
        title="You do not have access to this page"
        description="This area is only for the people who manage school subscriptions."
      />
    </div>
  );
}

/** Route guard: requires a specific permission, else shows a clear refusal. */
export function RequirePermission({
  require: requirement,
  children,
}: {
  require: PermissionRequirement;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  if (can(requirement)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Lock />}
        data-cy="access-denied"
        title="You do not have access to this page"
        description="Your role in this school does not include this area. Ask a school administrator if you think that is wrong."
      />
    </div>
  );
}
