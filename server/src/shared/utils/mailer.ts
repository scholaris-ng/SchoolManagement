import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';

/**
 * Outbound mail (`server_arch.md` section 22).
 *
 * `emailLayout()` is the only place `<html>` and `<body>` appear. Every send
 * function below produces body HTML from the component blocks in section 22.3
 * and hands it to that wrapper — there is exactly one layout in this codebase.
 *
 * Two rules the templates hold to:
 *
 * - Every value that reaches the HTML goes through `escapeHtml` first. School
 *   and family names are typed by people, and a name carrying an ampersand
 *   must render as itself rather than as broken markup.
 * - Nothing commercial reaches a recipient who did not sign up for it. Plan,
 *   billing and subscription wording belongs to whoever owns the account, and
 *   never in the mail a teacher or a parent receives.
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

/**
 * Makes a value safe to drop into the templates below.
 *
 * Everything interpolated here is somebody's typed input — a school name, a
 * person's name, a child's name. An unescaped ampersand is invalid markup that
 * clients render inconsistently, and an unescaped angle bracket ends the
 * document early. Applied at the call site, because the component blocks
 * themselves take HTML.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The shared shell: brand header, white body card, muted footer.
 *
 * `preheader` is the line an inbox shows beside the subject before the message
 * is opened. Without one, clients scrape the first text they find, which is the
 * greeting at best and stray markup at worst. It is deliberately never a code,
 * a password or anything else that should not appear on a lock screen.
 */
export function emailLayout(body: string, preheader?: string): string {
  const year = new Date().getFullYear();
  const hiddenPreheader = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <!-- Declared light, so a client in dark mode recolours predictably rather
       than inverting the card and leaving the header unreadable. -->
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${SURFACE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  ${hiddenPreheader}
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

/**
 * A credential shown once and never again.
 *
 * Set apart from the ordinary detail box on purpose. It is the one thing in the
 * message the reader must act on before it is lost, and it is monospaced so a
 * lowercase L is not mistaken for a 1 while it is being retyped.
 */
const secretBox = (label: string, secret: string) =>
  `<div style="background:${SURFACE};border:1.5px solid ${CARD_BORDER};border-radius:10px;padding:20px 16px;text-align:center;margin:0 0 16px">
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${MUTED_TEXT}">${label}</p>
    <span style="font-size:24px;font-weight:700;letter-spacing:2px;color:${BRAND_DARK};font-family:'Courier New',Courier,monospace;word-break:break-all">${secret}</span>
  </div>`;

const footnote = (text: string) =>
  `<p style="margin:16px 0 0;font-size:13px;color:${MUTED_TEXT};line-height:1.6">${text}</p>`;

const button = (label: string, url: string) =>
  `<div style="text-align:center;margin:28px 0 12px">
    <a href="${url}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 36px;border-radius:8px">${label}</a>
  </div>`;

/**
 * The same destination as plain text, under the button.
 *
 * Plenty of corporate clients strip or fail to render the styled anchor, which
 * leaves a message whose whole purpose is a link with no link in it.
 */
const buttonFallback = (url: string) =>
  `<p style="margin:0;font-size:12px;color:${MUTED_TEXT};line-height:1.6;text-align:center;word-break:break-all">Or paste this into your browser: ${url}</p>`;

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
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);

  const body = [
    heading('Verify your email address'),
    paragraph(`Hello ${name}, thank you for registering <strong>${school}</strong> on Scholaris.`),
    paragraph('Enter this code to confirm this email address belongs to you:'),
    codeBox(escapeHtml(code)),
    paragraph(`The code expires in ${expiresInMinutes} minutes.`),
    footnote(
      'If you did not register a school on Scholaris, you can ignore this email — no account can be used until this code is entered.',
    ),
  ].join('');

  await send({
    to,
    subject: 'Verify your email — Scholaris',
    // The code itself stays out of the preview line: it is readable from a
    // locked phone by anyone holding it.
    html: emailLayout(body, `Your confirmation code expires in ${expiresInMinutes} minutes.`),
    text: [
      `Hello ${firstName},`,
      '',
      `Your Scholaris verification code is ${code}.`,
      `It expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not register a school on Scholaris, you can ignore this email.',
    ].join('\n'),
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
  const childList = childNames.length > 0 ? childNames.join(', ') : 'your child';
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const children = escapeHtml(childList);
  const signInUrl = `${env.appUrl}/sign-in`;

  const body = [
    heading(`${school} has invited you to the parent portal`),
    paragraph(
      `Hello ${name}, you can now follow attendance, results, fees and messages for <strong>${children}</strong> online.`,
    ),
    paragraph('Enter this code to confirm your email address and set a password:'),
    codeBox(escapeHtml(code)),
    paragraph(`The code expires in ${expiresInMinutes} minutes.`),
    button('Open the parent portal', signInUrl),
    buttonFallback(signInUrl),
    footnote(
      `If you were not expecting this, please contact ${school} directly — no account can be used until this code is entered.`,
    ),
  ].join('');

  await send({
    to,
    subject: `Parent portal invitation — ${schoolName} — Scholaris`,
    html: emailLayout(body, `Follow attendance, results and fees for ${childList}.`),
    text: [
      `Hello ${firstName},`,
      '',
      `${schoolName} has invited you to the Scholaris parent portal for ${childList}.`,
      '',
      `Your code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      `Open ${signInUrl} to confirm your address and set a password.`,
      '',
      `If you were not expecting this, please contact ${schoolName} directly.`,
    ].join('\n'),
  });
}

/**
 * Recipient: the school administrator, once verified. Trigger: a successful
 * `POST /auth/verify-email`. Tone: celebratory — emoji permitted in the heading.
 *
 * Says nothing about plans, trials or subscriptions. This is the welcome for
 * someone who has just set a school up and wants to know what to do next, and
 * the answer to that is their level ladder, not their billing. The plan named
 * here previously was a hardcoded string, so it would have been wrong the day
 * a school arrived on anything other than a trial.
 */
export async function sendSchoolReadyEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  schoolCode: string;
}): Promise<void> {
  const { to, firstName, schoolName, schoolCode } = params;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const setupUrl = `${env.appUrl}/settings`;

  const body = [
    heading('Your school is ready 🎉'),
    paragraph(
      `Hello ${name}, <strong>${school}</strong> is set up and you are signed in as its administrator.`,
    ),
    infoBox([
      ['School', school],
      ['School code', escapeHtml(schoolCode)],
    ]),
    paragraph(
      'The next step is to describe your school: define your level ladder, add classes and subjects, then set the academic session and terms. Staff, students, timetables and results all build on those.',
    ),
    button('Set up your school', setupUrl),
    buttonFallback(setupUrl),
    footnote(
      'Your school code is this school’s short reference on Scholaris. Quote it if you ever need to contact support.',
    ),
  ].join('');

  await send({
    to,
    subject: `Your school is ready — ${schoolName} — Scholaris`,
    html: emailLayout(body, 'Define your levels, classes and subjects to finish setting up.'),
    text: [
      `Hello ${firstName},`,
      '',
      `${schoolName} (school code ${schoolCode}) is set up on Scholaris and you are its administrator.`,
      '',
      'Next, describe your school: define your level ladder, add classes and subjects, then set the academic session and terms.',
      `Start at ${setupUrl}`,
    ].join('\n'),
  });
}

/**
 * Recipient: anyone who asked to reset their own password. Trigger:
 * `POST /auth/forgot-password`. Tone: transactional — no emoji.
 *
 * The link is generated by the identity provider and sent from here rather
 * than by the provider itself, so a password reset looks like every other mail
 * this school's people receive instead of arriving unbranded from somewhere
 * they have never heard of.
 *
 * It names nothing about the account beyond the address that asked, because
 * whoever receives it has not proved they are the account holder yet.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInHours: number;
}): Promise<void> {
  const { to, firstName, resetUrl, expiresInHours } = params;
  const name = escapeHtml(firstName);
  const hours = expiresInHours === 1 ? 'one hour' : `${expiresInHours} hours`;

  const body = [
    heading('Reset your password'),
    paragraph(`Hello ${name}, we received a request to set a new password for this address.`),
    paragraph('Choose a new one here:'),
    button('Set a new password', resetUrl),
    buttonFallback(resetUrl),
    paragraph(`The link works once and expires in ${hours}.`),
    footnote(
      'If you did not ask for this, you can ignore this email — your password has not changed, and nobody can set a new one without this link.',
    ),
  ].join('');

  await send({
    to,
    subject: 'Reset your password — Scholaris',
    // Never the link: a preheader renders on a locked phone, and this one is
    // enough on its own to take over the account.
    html: emailLayout(body, `Your reset link works once and expires in ${hours}.`),
    text: [
      `Hello ${firstName},`,
      '',
      'We received a request to set a new password for this address.',
      '',
      `Set a new password: ${resetUrl}`,
      `The link works once and expires in ${hours}.`,
      '',
      'If you did not ask for this, you can ignore this email. Your password has not changed.',
    ].join('\n'),
  });
}

/**
 * Recipient: the primary contact on a public application. Trigger: a
 * successful `POST /public/schools/:slug/applications`. Tone: transactional —
 * no emoji.
 *
 * The reference numbers are the point of this email, same as the receipt
 * shown on screen the moment they submit. That screen is easy to lose — a
 * closed tab, a phone that was borrowed to fill the form in — and the school
 * will ask for these numbers on every call about the application afterwards.
 * One email covers every child on the submission, because that is how a
 * parent filing for three of them experiences it: one trip to the form, one
 * moment of "it's done".
 */
export async function sendApplicationReceivedEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  applications: { applicationNo: string; applicantName: string; className: string }[];
  contactEmail: string;
}): Promise<void> {
  const { to, firstName, schoolName, applications, contactEmail } = params;
  const many = applications.length > 1;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);

  const body = [
    heading(many ? 'Applications received' : 'Application received'),
    paragraph(
      `Hello ${name}, <strong>${school}</strong> has received ${many ? 'these applications' : 'this application'}. Keep ${many ? 'these references' : 'this reference'} — you will be asked for ${many ? 'them' : 'it'} whenever you call about the application.`,
    ),
    infoBox(
      applications.map((application) => [
        escapeHtml(application.applicantName),
        `${escapeHtml(application.applicationNo)} · ${escapeHtml(application.className)}`,
      ]),
    ),
    paragraph(
      'What happens next: the admissions office reviews the application and will contact you about screening. Nobody is admitted, and no parent account is created, until a place has been offered and accepted.',
    ),
    footnote(`Questions in the meantime? Write to ${school} at ${escapeHtml(contactEmail)}.`),
  ].join('');

  await send({
    to,
    subject: `${many ? 'Applications' : 'Application'} received — ${schoolName} — Scholaris`,
    html: emailLayout(body, `Your application reference${many ? 's are' : ' is'} inside.`),
    text: [
      `Hello ${firstName},`,
      '',
      `${schoolName} has received ${many ? 'these applications' : 'this application'}:`,
      '',
      ...applications.map(
        (application) =>
          `${application.applicantName} — ${application.applicationNo} (${application.className})`,
      ),
      '',
      `Keep ${many ? 'these references' : 'this reference'} — you will be asked for ${many ? 'them' : 'it'} whenever you call about the application.`,
      '',
      'What happens next: the admissions office reviews the application and will contact you about screening.',
      'Nobody is admitted, and no parent account is created, until a place has been offered and accepted.',
      '',
      `Questions in the meantime? Write to ${schoolName} at ${contactEmail}.`,
    ].join('\n'),
  });
}

/**
 * `message` is the fact of what happened; `explanation` is what it means —
 * split apart because "shortlisted" or "screening" mean nothing to a parent
 * who has never seen this workflow before, and the fact alone answered
 * nothing about what, if anything, they now need to do.
 */
const STATUS_COPY: Record<
  'SUBMITTED' | 'SCREENING' | 'SHORTLISTED' | 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN',
  {
    subject: string;
    heading: string;
    message: (applicant: string, school: string, className: string | null) => string;
    explanation: string;
  }
> = {
  SUBMITTED: {
    subject: 'Application submitted',
    heading: 'Application submitted',
    message: (applicant, school) => `${school} has recorded ${applicant}’s application as submitted.`,
    explanation: 'The admissions office will review it and be in touch about the next step. No action is needed from you right now.',
  },
  SCREENING: {
    subject: 'Your application is being reviewed',
    heading: 'Application under review',
    message: (applicant, school) => `${school} has begun reviewing ${applicant}’s application.`,
    explanation:
      'This may include an interview, an entrance test, or whatever else the school normally uses to decide. No action is needed from you right now — the office will contact you if it needs anything.',
  },
  SHORTLISTED: {
    subject: 'Good news about the application',
    heading: 'Shortlisted',
    message: (applicant, school) =>
      `${school} has shortlisted ${applicant}’s application for further consideration.`,
    explanation:
      'This is a positive sign, though a final decision has not been made yet. No action is needed from you right now.',
  },
  OFFERED: {
    subject: 'A place has been offered',
    heading: 'A place has been offered',
    message: (applicant, school, className) =>
      className
        ? `${school} is offering ${applicant} a place in ${className}.`
        : `${school} is offering ${applicant} a place.`,
    explanation:
      'This place is reserved, but it is not final until you confirm it — families often apply to more than one school, so the office needs to hear that this one has been accepted before it can be treated as settled.',
  },
  ACCEPTED: {
    subject: 'Acceptance recorded',
    heading: 'Acceptance recorded',
    message: (applicant, school) =>
      `${school} has recorded that the place offered to ${applicant} has been accepted.`,
    explanation: 'The next step is enrolment, which the school’s office will arrange with you directly.',
  },
  REJECTED: {
    subject: 'Update on the application',
    heading: 'Update on the application',
    message: (applicant, school) => `After review, ${school} is unable to offer ${applicant} a place at this time.`,
    explanation: 'No action is needed from you. If you would like feedback, the office is the right place to ask.',
  },
  WITHDRAWN: {
    subject: 'Application withdrawn',
    heading: 'Application withdrawn',
    message: (applicant, school) => `${school} has recorded ${applicant}’s application as withdrawn.`,
    explanation: 'No action is needed from you. If this was not requested, please contact the office straight away.',
  },
};

/**
 * Recipient: the primary contact on an application. Trigger: any status
 * change made from the admissions screen — beginning screening, shortlisting,
 * an offer, an acceptance the office has recorded, a rejection, or a
 * withdrawal. Tone: transactional, and deliberately even-handed — the same
 * plain layout carries good news and bad, because a rejection dressed up to
 * look upbeat reads worse than a plain one.
 *
 * One template for every stage rather than one per stage: to the family
 * reading it, this is news about one application, whatever the news is.
 */
export async function sendApplicationStatusEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  applicantName: string;
  applicationNo: string;
  status: keyof typeof STATUS_COPY;
  className?: string | null;
  offerExpiresOn?: string | null;
  /** The "respond to this offer" link — present only when the offer was just made. */
  offerUrl?: string;
  note?: string | null;
  contactEmail: string;
}): Promise<void> {
  const { to, firstName, schoolName, applicantName, applicationNo, status, note, contactEmail } = params;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const applicant = escapeHtml(applicantName);
  const className = params.className ? escapeHtml(params.className) : null;
  const copy = STATUS_COPY[status];
  const message = copy.message(applicant, school, className);

  const rows: [string, string][] = [
    ['Applicant', applicant],
    ['Reference', escapeHtml(applicationNo)],
  ];
  if (className) rows.push(['Class', className]);
  if (status === 'OFFERED' && params.offerExpiresOn) {
    rows.push(['Respond by', escapeHtml(params.offerExpiresOn)]);
  }

  // What to actually do about it — the one thing a status update on its own
  // never says. Only a fresh offer has anything left to act on; every other
  // outcome is either "wait" or "already settled". Preferring the link over
  // "call the office" where one exists: a family can act on it at midnight,
  // and the school does not have to staff a phone to receive an answer.
  const action = status === 'OFFERED' ? offerAction(params.offerExpiresOn, Boolean(params.offerUrl)) : '';

  const body = [
    heading(copy.heading),
    paragraph(`Hello ${name}, ${message}`),
    paragraph(copy.explanation),
    infoBox(rows),
    action ? paragraph(action) : '',
    status === 'OFFERED' && params.offerUrl ? button('Accept or decline online', params.offerUrl) : '',
    status === 'OFFERED' && params.offerUrl ? buttonFallback(params.offerUrl) : '',
    note ? paragraph(`<strong>A note from the school:</strong> ${escapeHtml(note)}`) : '',
    footnote(`Questions? Write to ${school} at ${escapeHtml(contactEmail)}.`),
  ].join('');

  await send({
    to,
    subject: `${copy.subject} — ${schoolName} — Scholaris`,
    html: emailLayout(body, copy.heading),
    text: [
      `Hello ${firstName},`,
      '',
      copy.message(applicantName, schoolName, params.className ?? null),
      copy.explanation,
      '',
      `Applicant: ${applicantName}`,
      `Reference: ${applicationNo}`,
      ...(params.className ? [`Class: ${params.className}`] : []),
      ...(status === 'OFFERED' && params.offerExpiresOn ? [`Respond by: ${params.offerExpiresOn}`] : []),
      ...(action ? ['', action.replace(/<\/?strong>/g, '')] : []),
      ...(status === 'OFFERED' && params.offerUrl ? [`Respond online: ${params.offerUrl}`] : []),
      ...(note ? ['', `A note from the school: ${note}`] : []),
      '',
      `Questions? Write to ${schoolName} at ${contactEmail}.`,
    ].join('\n'),
  });
}

/** The one instruction an offer email exists to deliver, in its several variants. */
function offerAction(offerExpiresOn: string | null | undefined, hasLink: boolean): string {
  const byDate = offerExpiresOn ? ` by <strong>${escapeHtml(offerExpiresOn)}</strong>` : '';
  const consequence = offerExpiresOn
    ? ' If nobody hears from you by then, the place may be offered to someone else.'
    : '';
  return hasLink
    ? `Please accept or decline${byDate} using the button below — no account or password needed.${consequence}`
    : `Please contact the school office${byDate} to confirm this place.${consequence}`;
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
 *
 * It tells a new employee about their job and nothing about the school's
 * account. What they need is where to sign in and what they were hired as.
 */
export async function sendStaffAccountEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  designation: string;
  temporaryPassword: string;
}): Promise<void> {
  const { to, firstName, schoolName, designation, temporaryPassword } = params;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const role = escapeHtml(designation);
  const signInUrl = `${env.appUrl}/sign-in`;

  const body = [
    heading(`Welcome to ${school}`),
    paragraph(
      `Hello ${name}, an account has been created for you on <strong>${school}</strong>’s Scholaris portal.`,
    ),
    infoBox([
      ['Role', role],
      ['Sign in with', escapeHtml(to)],
    ]),
    secretBox('Temporary password', escapeHtml(temporaryPassword)),
    paragraph(
      'This password is shown here once and is kept nowhere else. Change it as soon as you sign in.',
    ),
    button('Sign in', signInUrl),
    buttonFallback(signInUrl),
    footnote(
      `If you were not expecting this account, do not sign in — please contact ${school} directly.`,
    ),
  ].join('');

  await send({
    to,
    subject: `Your account is ready — ${schoolName} — Scholaris`,
    // Never the password. A preheader shows on a lock screen, in front of
    // whoever is holding the phone.
    html: emailLayout(body, `Your sign-in details for ${schoolName} are inside.`),
    text: [
      `Hello ${firstName},`,
      '',
      `An account has been created for you on ${schoolName}'s Scholaris portal, as ${designation}.`,
      '',
      `Sign in at ${signInUrl}`,
      `Email: ${to}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      'This password is shown once and is kept nowhere else. Change it as soon as you sign in.',
      '',
      `If you were not expecting this account, do not sign in — please contact ${schoolName} directly.`,
    ].join('\n'),
  });
}
