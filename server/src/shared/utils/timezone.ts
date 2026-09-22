/** What `RegistrationService` gives every school until it says otherwise. */
export const DEFAULT_TIMEZONE = 'Africa/Lagos';

/** `Region/City`, optionally with a third part (`America/Argentina/Buenos_Aires`). */
const NAMED_ZONE = /^[A-Za-z_]+(?:\/[A-Za-z_-]+){1,2}$/;

/**
 * A timezone name that is safe to hand to PostgreSQL's `AT TIME ZONE`.
 *
 * A school's `settings.timezone` is free text, and PostgreSQL throws on a name
 * it does not know — which would turn a bad setting into a failing list screen.
 * Only a named zone (or UTC) is accepted: a bare offset like `+01:00` is read
 * by PostgreSQL as POSIX, where the sign means the opposite of what it means
 * everywhere else, so it would silently shift every boundary by two hours.
 */
/** A wall-clock reading in one zone: the calendar date, and the time as `HH:mm`. */
export interface LocalClock {
  year: number;
  month: number;
  day: number;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, 24-hour */
  time: string;
}

/**
 * What the clock on the wall says at a school right now.
 *
 * The server runs wherever the host puts it; a school's day starts when *its*
 * day starts. Used by anything scheduled "at 08:00" — a birthday text sent at
 * 08:00 UTC reaches a Lagos parent at 09:00 and a Nairobi one at 11:00, which
 * is not what the administrator asked for.
 */
export function localClock(now: Date, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: resolveTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = Number(read('year'));
  const month = Number(read('month'));
  const day = Number(read('day'));
  // Some ICU builds print midnight as "24" in 24-hour mode.
  const hour = read('hour').replace(/^24$/, '00');
  return {
    year,
    month,
    day,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${hour}:${read('minute')}`,
  };
}

export function resolveTimezone(candidate: string | null | undefined): string {
  const name = candidate?.trim();
  if (!name || (name !== 'UTC' && !NAMED_ZONE.test(name))) return DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return name;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
