const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a school stands on its subscription, as the client is told it.
 *
 * `plan` is the school's `status` — a free trial, or activated by an
 * administrator — and says nothing about whether the school may sign in. That
 * is `expired` alone, and it is decided by a date, so a trial and a paid month
 * lock in exactly the same way and there is no second rule to keep in step.
 */
export interface SchoolAccessDTO {
  plan: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  /** ISO timestamp of the moment access ends. */
  endsAt: string;
  expired: boolean;
  /** Whole days left, rounded up so the last partial day still reads "1 day left". Zero once expired. */
  daysLeft: number;
  /** Who to write to for an activation, or `null` when none is configured. */
  contactEmail: string | null;
}

export function describeAccess(
  school: { status: SchoolAccessDTO['plan']; accessEndsAt: Date | string },
  contactEmail: string | null,
  now: Date = new Date(),
): SchoolAccessDTO {
  const ends = new Date(school.accessEndsAt);
  const remaining = ends.getTime() - now.getTime();

  return {
    plan: school.status,
    endsAt: ends.toISOString(),
    expired: remaining <= 0,
    daysLeft: Math.max(0, Math.ceil(remaining / DAY_MS)),
    contactEmail,
  };
}
