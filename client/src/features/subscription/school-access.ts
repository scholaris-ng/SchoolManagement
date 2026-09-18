import type { AuthenticatedUser, SchoolAccess, SchoolMembership } from '@/types/tenant';

/**
 * The rules about a school's trial and subscription, with no React in them.
 *
 * Kept apart from `use-school-access.ts` because the auth provider needs
 * `isLocked` to decide how often to re-read the session, and the hook needs the
 * auth provider — one module holding both would import itself.
 */

/** From this many days out, the header stops being a calm badge and starts warning. */
export const WARN_WITHIN_DAYS = 3;

export const PLAN_LABEL: Record<SchoolAccess['plan'], string> = {
  TRIAL: 'Free trial',
  ACTIVE: 'Active plan',
  SUSPENDED: 'Suspended',
};

export interface AccessView extends SchoolAccess {
  /** Still open, but close enough to the end that someone should be told. */
  warn: boolean;
}

export function viewAccess(access: SchoolAccess): AccessView {
  return { ...access, warn: !access.expired && access.daysLeft <= WARN_WITHIN_DAYS };
}

/**
 * Whether this person is shut out of the school they are looking at.
 *
 * Not `access.expired` alone: the people who run the platform are never locked
 * out by a school's clock — the server makes the same exception, and one that
 * did not would leave them unable to reach the screen that lets a school back in.
 */
export function isLocked(
  user: Pick<AuthenticatedUser, 'canManageSubscriptions' | 'isPlatformAdmin'> | null,
  membership: Pick<SchoolMembership, 'access'> | null,
): boolean {
  if (!user || !membership) return false;
  if (user.canManageSubscriptions || user.isPlatformAdmin) return false;
  // `?.` although the type says it is always there: the client and the API are
  // deployed separately, and a client that reaches users first would otherwise
  // crash the whole app on a session that does not carry `access` yet.
  return membership.access?.expired ?? false;
}

/** A pre-written email asking for the school to be activated, so the admin need not ask who is writing. */
export function activationMailto(params: {
  to: string;
  schoolName: string;
  schoolSlug: string;
  userEmail?: string | null;
  plan: SchoolAccess['plan'];
}): string {
  const verb = params.plan === 'TRIAL' ? 'activate' : 'renew';
  const subject = `${verb === 'activate' ? 'Activate' : 'Renew'} ${params.schoolName}`;
  const body = [
    'Hello,',
    '',
    `Please ${verb} the ${params.schoolName} account.`,
    '',
    `School: ${params.schoolName}`,
    `School address: ${params.schoolSlug}`,
    ...(params.userEmail ? [`Signed in as: ${params.userEmail}`] : []),
    '',
    'Thank you.',
  ].join('\n');

  return `mailto:${params.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
