import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { SchoolMark } from '@/components/layout/school-switcher';
import { PLAN_LABEL } from './school-access';
import { useSchoolAccess } from './use-school-access';

type Access = NonNullable<ReturnType<typeof useSchoolAccess>>;

const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** What the pill says, and how loudly. A trial counts down; a paid month shows the date it runs to. */
function pillFor(access: Access): { text: string; tone: 'success' | 'warning' | 'danger' } {
  if (access.expired) return { text: `Ended ${formatDate(access.endsAt)}`, tone: 'danger' };
  if (access.warn) return { text: `${plural(access.daysLeft)} left`, tone: 'warning' };
  if (access.plan === 'TRIAL') return { text: `${plural(access.daysLeft)} left`, tone: 'success' };
  return { text: `Valid until ${formatDate(access.endsAt)}`, tone: 'success' };
}

const PILL_TONE = {
  success: 'border-success/20 bg-success-subtle text-success',
  warning: 'border-warning/30 bg-warning-subtle text-warning',
  danger: 'border-danger/20 bg-danger-subtle text-danger',
} as const;

/**
 * The school's plan, in the header: who it is, which plan, and how long it runs.
 *
 * Once a school's trial has ended for the people who are locked out by it, this
 * becomes the one button that matters — a way to reach whoever can activate it.
 */
export function SchoolPlanBadge() {
  const access = useSchoolAccess();
  if (!access) return null;
  if (access.locked) return <ContactAdminButton />;

  const pill = pillFor(access);
  const { membership } = access;

  return (
    <div
      data-cy="school-plan-badge"
      title={`${PLAN_LABEL[access.plan]} — ${access.expired ? 'ended' : 'ends'} ${formatDate(access.endsAt)}${
        access.expired ? '' : ` (${plural(access.daysLeft)} left)`
      }`}
      className="ml-1 hidden items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1.5 pr-2.5 lg:flex"
    >
      <SchoolMark
        name={membership.schoolShortName}
        logoUrl={membership.branding.logoUrl}
        color={membership.branding.primaryColor}
      />
      <div className="min-w-0 leading-tight">
        <p className="max-w-[9rem] truncate text-xs font-semibold">{membership.schoolShortName}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {PLAN_LABEL[access.plan]}
          </span>
          <span
            data-cy="school-plan-pill"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium',
              PILL_TONE[pill.tone],
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {pill.text}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Opens an email to the person who can activate the school, already written.
 *
 * A mail link, not a form: there is no ticketing behind this, and a person whose
 * school has just been locked is best served by the tool they already have open.
 */
export function ContactAdminButton({ className }: { className?: string }) {
  const access = useSchoolAccess();
  if (!access) return null;

  const ended = access.plan === 'TRIAL' ? 'Trial ended' : 'Subscription ended';
  const action = access.plan === 'TRIAL' ? 'activate' : 'renew';

  // No address configured on the server: still say what happened, and who to ask.
  if (!access.mailto) {
    return (
      <span data-cy="contact-admin-button" className={cn('text-xs font-medium text-danger', className)}>
        {ended} · Contact your administrator to {action}
      </span>
    );
  }

  return (
    <Button asChild variant="danger" size="sm" className={className}>
      <a data-cy="contact-admin-button" href={access.mailto}>
        <Mail aria-hidden="true" />
        <span className="hidden md:inline">{ended} ·</span>
        Contact admin to {action}
      </a>
    </Button>
  );
}
