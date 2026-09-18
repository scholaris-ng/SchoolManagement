import { env } from '../../config/env';
import { AppsScriptProvider } from './providers/apps-script.provider';
import { NodemailerProvider } from './providers/nodemailer.provider';
import type { MailProvider } from './types';

/**
 * Picks the transport for one send. Every `send*Email` function in
 * `mailer.ts` — auth mail included — passes its `schoolEmail` (a school's own
 * `schools.email` column, not the recipient) through to `send()`, which hands
 * it here. Matching it against the `EMAIL_APPS_SCRIPT_SCHOOL_EMAIL` list
 * routes that school's mail through Apps Script; every other school, and any
 * send with no resolvable school (no `schoolEmail` at all), keeps using SMTP.
 *
 * To make Apps Script the default for everyone instead of nodemailer, or to
 * drop it back to nodemailer everywhere, change what this function returns —
 * nothing above it (the `send*Email` functions, their call sites) needs to
 * change either way.
 */
const nodemailerProvider = new NodemailerProvider();
let appsScriptProvider: AppsScriptProvider | null = null;

export function resolveProvider(schoolEmail?: string | null): MailProvider | null {
  if (schoolEmail && env.email.appsScript.configured && env.email.appsScript.schoolEmails.has(schoolEmail.toLowerCase())) {
    if (!appsScriptProvider) {
      appsScriptProvider = new AppsScriptProvider(env.email.appsScript.url!);
    }
    return appsScriptProvider;
  }

  return env.email.configured ? nodemailerProvider : null;
}
