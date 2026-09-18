import { useState } from 'react';
import { LockKeyhole, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { SchoolMark } from '@/components/layout/school-switcher';
import { ContactAdminButton } from './school-plan-badge';
import { useSchoolAccess } from './use-school-access';

/**
 * What a school's people see once its trial or subscription has run out.
 *
 * A frame of its own rather than the app shell with the page blanked: the shell
 * is full of things that ask the server for data — the term badge, unread counts,
 * the outbox — every one of which would now be refused. This asks for nothing.
 * The one thing it does ask for, on a timer, is the session, so a school
 * activated while someone is looking at this is let back in by itself.
 */
export function SubscriptionLockedFrame() {
  const { memberships, membership, switchSchool, signOut, refreshSession } = useAuth();
  const access = useSchoolAccess();
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  if (!membership || !access) return null;

  const trial = access.plan === 'TRIAL';
  // Other schools this person can still work in: switching is the way out
  // for someone who belongs to more than one.
  const others = memberships.filter(
    (entry) => entry.schoolId !== membership.schoolId && !entry.access?.expired,
  );

  const check = async () => {
    setChecking(true);
    try {
      await refreshSession();
      setCheckedAt(new Date());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background" data-cy="subscription-locked">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
        <SchoolMark
          name={membership.schoolShortName}
          logoUrl={membership.branding.logoUrl}
          color={membership.branding.primaryColor}
        />
        <span className="min-w-0 truncate text-sm font-semibold">{membership.schoolName}</span>
        <div className="ml-auto flex items-center gap-2">
          <ContactAdminButton />
          <Button
            variant="ghost"
            size="sm"
            data-cy="locked-sign-out"
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 pt-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-subtle text-danger">
              <LockKeyhole className="size-6" aria-hidden="true" />
            </span>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold">
                {trial ? 'Your free trial has ended' : 'Your subscription has ended'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Access to {membership.schoolName} is paused. Nothing has been lost — everything will
                be here as soon as the administrator activates the account.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <ContactAdminButton className="h-10 px-5 text-sm" />
              <Button
                variant="outline"
                size="sm"
                data-cy="locked-check-again"
                loading={checking}
                loadingLabel="Checking…"
                onClick={() => void check()}
              >
                <RefreshCw aria-hidden="true" />
                Already activated? Check again
              </Button>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {checkedAt
                  ? `Checked at ${formatDateTime(checkedAt)} — still waiting for activation.`
                  : 'This page opens by itself once the school is activated.'}
              </p>
            </div>

            {others.length > 0 && (
              <div className="border-t border-border pt-4 text-left">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Or work in another school
                </p>
                <ul className="space-y-1.5">
                  {others.map((entry) => (
                    <li key={entry.schoolId}>
                      <Button
                        variant="outline"
                        size="sm"
                        block
                        className="h-auto justify-start py-1.5"
                        onClick={() => switchSchool(entry.schoolId)}
                      >
                        <SchoolMark
                          name={entry.schoolShortName}
                          logoUrl={entry.branding.logoUrl}
                          color={entry.branding.primaryColor}
                        />
                        {entry.schoolName}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
