import type { MailMessage, MailProvider } from '../types';

/**
 * Sends through a Google Apps Script Web App deployed with a `doPost(e)` that
 * calls `GmailApp.sendEmail`. Used for one school for now (see
 * `router.ts`) while nodemailer stays the default for everyone else.
 *
 * `script.google.com/.../exec` always 302-redirects to a
 * `script.googleusercontent.com/macros/echo` URL that carries the response
 * Apps Script returned — but the script itself, and the actual send, already
 * ran on this first request before the redirect is issued. Node's `fetch`
 * downgrades the follow-up to a GET with no body (per the WHATWG redirect
 * spec, since the original method was POST), which is exactly right here:
 * resending the JSON body on that second hop is not required and — on at
 * least one HTTP client we tried by hand (curl on Windows) — corrupts the
 * request. Do not "fix" this into a raw POST-preserving redirect.
 */
export class AppsScriptProvider implements MailProvider {
  constructor(private readonly webAppUrl: string) {}

  async send({ to, subject, html, text }: MailMessage): Promise<void> {
    const response = await fetch(this.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, htmlBody: html, body: text }),
    });

    if (!response.ok) {
      throw new Error(`Apps Script mail webhook responded ${response.status} ${response.statusText}`);
    }
  }
}
