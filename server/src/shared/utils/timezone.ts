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
