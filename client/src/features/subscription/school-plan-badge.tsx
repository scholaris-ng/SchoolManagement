import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
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

/** The plan line in the account menu stays calm until there is something to act on. */
const SUMMARY_TONE = {
  success: 'text-muted-foreground',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

/** The full sentence, for a tooltip: plan, when it ends, and how long that is. */
function describe(access: Access): string {
  return `${PLAN_LABEL[access.plan]} — ${access.expired ? 'ended' : 'ends'} ${formatDate(access.endsAt)}${
    access.expired ? '' : ` (${plural(access.daysLeft)} left)`
  }`;
}

/**
 * Whether the plan has earned a place in the header. A healthy paid plan has
 * nothing to tell anyone every day, so it waits in the account menu; a trial
 * is a countdown someone should be able to see, and a plan in its last days or
 * past its end is a decision.
 */
function needsAttention(access: Access): boolean {
  return access.expired || access.warn || access.plan === 'TRIAL';
}

/**
 * The school's plan, in the header — but only when it needs to be there.
 *
 * Once a school's trial has ended for the people who are locked out by it, this
 * becomes the one button that matters — a way to reach whoever can activate it.
 * The school's own name and mark live in the sidebar and the account menu
 * (`SchoolPlanSummary`); repeating them here put two avatars side by side.
 */
export function SchoolPlanBadge() {
  const access = useSchoolAccess();
  if (!access) return null;
  if (access.locked) return <ContactAdminButton />;
  if (!needsAttention(access)) return null;

  const pill = pillFor(access);

  return (
    <span
      data-cy="school-plan-badge"
      title={describe(access)}
      className="hidden lg:inline-flex"
    >
      <span
        data-cy="school-plan-pill"
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
          PILL_TONE[pill.tone],
        )}
      >
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        {/* Without the plan, "12 days left" doesn't say left of what. An ended
            plan's date already says it all. */}
        {!access.expired && <span className="opacity-80">{PLAN_LABEL[access.plan]} ·</span>}
        <span>{pill.text}</span>
      </span>
    </span>
  );
}

/**
 * Which school this is and where its plan stands, for the account menu.
 *
 * Always present — this is where a healthy plan lives, and where anyone on a
 * screen too narrow for the header pill finds the same answer.
 */
export function SchoolPlanSummary() {
  const { membership } = useAuth();
  const access = useSchoolAccess();
  if (!membership) return null;

  const pill = access ? pillFor(access) : null;

  return (
    <div data-cy="school-plan-summary" className="flex items-center gap-2.5">
      <SchoolMark
        name={membership.schoolShortName}
        logoUrl={membership.branding.logoUrl}
        color={membership.branding.primaryColor}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{membership.schoolName}</p>
        {access && pill && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={describe(access)}>
            {PLAN_LABEL[access.plan]} ·{' '}
            <span className={SUMMARY_TONE[pill.tone]}>{pill.text}</span>
          </p>
        )}
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
