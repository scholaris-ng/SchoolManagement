import { Navigate } from 'react-router-dom';
import { GraduationCap, LogOut, MailQuestion, RefreshCw } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { FullPageLoader } from '@/components/layout/full-page-loader';

/**
 * Where a signed-in user lands when their identity is valid but no school has
 * granted them a membership yet.
 *
 * Memberships are created by a school administrator (or by accepting an
 * invitation), never self-serve from the browser — that is what stops a
 * stranger with a Google account from attaching themselves to a school.
 */
export function OnboardingPage() {
  const { status, identityUser, memberships, refreshSession, signOut } = useAuth();

  if (status === 'loading') return <FullPageLoader label="Checking your access…" />;
  if (status === 'unauthenticated') return <Navigate to="/sign-in" replace />;
  if (memberships.length > 0) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Scholaris</span>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <span className="grid size-11 place-items-center rounded-full bg-primary-subtle text-primary">
              <MailQuestion className="size-5" aria-hidden="true" />
            </span>

            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight">
                Your account is not linked to a school yet
              </h1>
              <p className="text-sm text-muted-foreground">
                You are signed in as{' '}
                <span className="font-medium text-foreground">{identityUser?.email}</span>, but no
                school has added you to their staff or parent list.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What to do next</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>
                  Ask your school administrator to invite this exact email address — an invitation
                  sent to a different address will not reach this account.
                </li>
                <li>If you have just been invited, check again in a moment.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button data-cy="onboarding-check-again" onClick={() => void refreshSession()} block>
                <RefreshCw />
                Check again
              </Button>
              <Button data-cy="onboarding-sign-out" variant="outline" onClick={() => void signOut()} block>
                <LogOut />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
