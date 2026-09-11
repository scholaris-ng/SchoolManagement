import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';

/**
 * Outbound mail (`server_arch.md` section 22).
 *
 * `emailLayout()` is the only place `<html>` and `<body>` appear. Every send
 * function below produces body HTML from the component blocks in section 22.3
 * and hands it to that wrapper — there is exactly one layout in this codebase.
 */

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BRAND_DARK = '#0f172a';
const BRAND_PRIMARY = '#1d4ed8';
const BODY_TEXT = '#374151';
const MUTED_TEXT = '#9ca3af';
const CARD_BORDER = '#e2e8f0';
const SURFACE = '#f8fafc';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.email.configured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    // 465 is implicit TLS; anything else negotiates with STARTTLS.
    secure: env.email.port === 465,
    auth: { user: env.email.user!, pass: env.email.password! },
  });
  return transporter;
}

/** The shared shell: brand header, white body card, muted footer. */
export function emailLayout(body: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SURFACE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${SURFACE};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;background:#ffffff;border:1px solid ${CARD_BORDER};border-radius:12px;overflow:hidden">
        <tr><td style="background:${BRAND_DARK};padding:20px 28px">
          <span style="font-size:24px;font-weight:700;color:${BRAND_PRIMARY}">Schol</span><span style="font-size:24px;font-weight:700;color:#ffffff">aris</span>
        </td></tr>
        <tr><td style="padding:40px">${body}</td></tr>
        <tr><td style="background:${SURFACE};border-top:1px solid ${CARD_BORDER};padding:18px 28px;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">&copy; ${year} Scholaris &middot; support@scholaris.software</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Component blocks (section 22.3) ─────────────────────────────────────────
const heading = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${BRAND_DARK};line-height:1.3">${text}</h1>`;

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:15px;color:${BODY_TEXT};line-height:1.65">${text}</p>`;

const codeBox = (code: string) =>
  `<div style="background:${SURFACE};border:1.5px solid ${CARD_BORDER};border-radius:10px;padding:28px 16px;text-align:center;margin:0 0 24px">
    <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:${BRAND_DARK};font-family:'Courier New',Courier,monospace">${code}</span>
  </div>`;

const infoBox = (rows: [string, string][]) =>
  `<div style="background:${SURFACE};border-left:3px solid ${BRAND_PRIMARY};border-radius:0 6px 6px 0;padding:14px 16px;margin:0 0 24px">
    ${rows
      .map(
        ([label, value], index) =>
          `<p style="margin:0${index < rows.length - 1 ? ' 0 8px' : ''};font-size:14px;color:${BODY_TEXT}"><strong>${label}:</strong> ${value}</p>`,
      )
      .join('')}
  </div>`;

const footnote = (text: string) =>
  `<p style="margin:16px 0 0;font-size:13px;color:${MUTED_TEXT};line-height:1.6">${text}</p>`;

const button = (label: string, url: string) =>
  `<div style="text-align:center;margin:28px 0">
    <a href="${url}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 36px;border-radius:8px">${label}</a>
  </div>`;

// ─── Transport ────────────────────────────────────────────────────────────────
interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends, or logs when no SMTP credentials are configured.
 *
 * Never throws. A failed send must not fail the operation that triggered it —
 * a school whose verification email bounced is still registered, and the right
 * response is a resend, not a rolled-back account.
 */
async function send({ to, subject, html, text }: SendArgs): Promise<void> {
  const mail = getTransporter();
  if (!mail) {
    console.info(`[mail] SMTP not configured. Would send to ${to}: ${subject}`);
    console.info(`[mail] ${text}`);
    return;
  }

  try {
    await mail.sendMail({
      from: `"${env.email.fromName}" <${env.email.user}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error(`[mail] Failed to send "${subject}" to ${to}:`, error);
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Recipient: the person registering a school. Trigger: `POST /auth/register`,
 * and `POST /auth/resend-verification`. Tone: transactional — no emoji.
 */
export async function sendVerificationEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  const { to, firstName, schoolName, code, expiresInMinutes } = params;

  const body = [
    heading('Verify your email address'),
    paragraph(`Hello ${firstName}, thank you for registering <strong>${schoolName}</strong> on Scholaris.`),
    paragraph('Enter this code to confirm this email address belongs to you:'),
    codeBox(code),
    paragraph(`The code expires in ${expiresInMinutes} minutes.`),
    footnote(
      'If you did not register a school on Scholaris, you can ignore this email — no account can be used until this code is entered.',
    ),
  ].join('');

  await send({
    to,
    subject: 'Verify your email — Scholaris',
    html: emailLayout(body),
    text: `Hello ${firstName}, your Scholaris verification code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not register a school, ignore this email.`,
  });
}

/**
 * Recipient: a parent or guardian a school has just invited. Trigger:
 * `POST /guardians/:id/invite`. Tone: transactional — no emoji.
 *
 * Carries the same six-digit code as ordinary verification, because an invited
 * account is created by the school and must still be claimed by the person who
 * controls the address. Without that step, anyone who guessed the email could
 * sign up and inherit access to a child's records.
 */
export async function sendGuardianInviteEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  childNames: string[];
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  const { to, firstName, schoolName, childNames, code, expiresInMinutes } = params;
  const children =
    childNames.length > 0 ? childNames.join(', ') : 'your child';

  const body = [
    heading(`${schoolName} has invited you to the parent portal`),
    paragraph(
      `Hello ${firstName}, you can now follow attendance, results, fees and messages for <strong>${children}</strong> online.`,
    ),
    paragraph('Enter this code to confirm your email address and set a password:'),
    codeBox(code),
    paragraph(`The code expires in ${expiresInMinutes} minutes.`),
    button('Open the parent portal', `${env.appUrl}/sign-in`),
    footnote(
      `If you were not expecting this, please contact ${schoolName} directly — no account can be used until this code is entered.`,
    ),
  ].join('');

  await send({
    to,
    subject: `Parent portal invitation — ${schoolName} — Scholaris`,
    html: emailLayout(body),
    text: `Hello ${firstName}, ${schoolName} has invited you to the Scholaris parent portal for ${children}. Your code is ${code}; it expires in ${expiresInMinutes} minutes. Open ${env.appUrl}/sign-in to continue.`,
  });
}

/**
 * Recipient: the school administrator, once verified. Trigger: a successful
 * `POST /auth/verify-email`. Tone: celebratory — emoji permitted in the heading.
 */
export async function sendSchoolReadyEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  schoolCode: string;
}): Promise<void> {
  const { to, firstName, schoolName, schoolCode } = params;

  const body = [
    heading('Your school is ready 🎉'),
    paragraph(`Hello ${firstName}, <strong>${schoolName}</strong> is set up and you are signed in as its administrator.`),
    infoBox([
      ['School', schoolName],
      ['School code', schoolCode],
      ['Plan', 'Trial'],
    ]),
    paragraph(
      'The next step is to describe your school: define your level ladder, add classes and subjects, then set the academic session and terms.',
    ),
    button('Open Scholaris', `${env.appUrl}/settings`),
    footnote('Your trial gives you the full product. Subscribe whenever you are ready to keep it.'),
  ].join('');

  await send({
    to,
    subject: `Your school is ready — ${schoolName} — Scholaris`,
    html: emailLayout(body),
    text: `Hello ${firstName}, ${schoolName} (code ${schoolCode}) is set up on Scholaris and you are its administrator. Open ${env.appUrl}/settings to define your levels, classes and subjects.`,
  });
}

/**
 * Recipient: a newly hired member of staff. Trigger: `POST /staff`, once the
 * account behind their new record exists. Tone: transactional — no emoji.
 *
 * The account is created with the password already set — there is no invite
 * code to enter first, unlike the guardian and registration flows above — so
 * this is the one email in this file that carries a credential rather than a
 * code. It is shown here exactly once: like the admin's own copy in the
 * create-staff dialog, the server keeps no record of it after this send.
 */
export async function sendStaffAccountEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  temporaryPassword: string;
}): Promise<void> {
  const { to, firstName, schoolName, temporaryPassword } = params;

  const body = [
    heading(`Welcome to ${schoolName}`),
    paragraph(
      `Hello ${firstName}, an account has been created for you on <strong>${schoolName}</strong>'s Scholaris portal.`,
    ),
    infoBox([
      ['Email', to],
      ['Temporary password', temporaryPassword],
    ]),
    button('Sign in', `${env.appUrl}/sign-in`),
    footnote(
      'Change this password as soon as you sign in. If you were not expecting this account, please contact the school directly.',
    ),
  ].join('');

  await send({
    to,
    subject: `Your account is ready — ${schoolName} — Scholaris`,
    html: emailLayout(body),
    text: `Hello ${firstName}, an account has been created for you on ${schoolName}'s Scholaris portal. Sign in at ${env.appUrl}/sign-in with ${to} and temporary password ${temporaryPassword}. Change it as soon as you sign in.`,
  });
}
