import { env } from '../../config/env';

/**
 * Whether this person may activate a school's subscription.
 *
 * Decided by a list of email addresses in configuration, not by a role or a
 * flag on the user: it is a power over every school on the platform, so it must
 * not be something a school's own administrator could grant themselves, and
 * adding another person is a change to the deployment's settings, not to data.
 *
 * The address must be verified (the emailed code, `users.email_verified`) as
 * well as listed. Without that, anyone who could get a row created with a
 * listed address would hold the power. `SUBSCRIPTION_ADMIN_EMAILS` empty means
 * nobody does.
 */
export function isSubscriptionAdmin(
  user: { email: string; emailVerified: boolean },
  allowed: ReadonlySet<string> = env.subscription.adminEmails,
): boolean {
  return user.emailVerified && allowed.has(user.email.trim().toLowerCase());
}
