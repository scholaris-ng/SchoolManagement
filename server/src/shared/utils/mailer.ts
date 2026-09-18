import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env';
import { resolveProvider } from '../mail/router';

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
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  /**
   * The sending school's own `schools.email` — never the recipient — used
   * only to pick a provider in `resolveProvider()`. Every send below carries
   * this when the caller can resolve one; a send with none (no membership
   * found, no school yet) always falls through to nodemailer.
   */
  schoolEmail?: string;
}

/**
 * Sends, or logs when no provider is configured for this send.
 *
 * Never throws. A failed send must not fail the operation that triggered it —
 * a school whose verification email bounced is still registered, and the right
 * response is a resend, not a rolled-back account.
 */
async function send({ to, subject, html, text, attachments, schoolEmail }: SendArgs): Promise<void> {
  const provider = resolveProvider(schoolEmail);
  if (!provider) {
    console.info(`[mail] No provider configured. Would send to ${to}: ${subject}`);
    console.info(`[mail] ${text}`);
    return;
  }

  try {
    await provider.send({ to, subject, html, text, attachments });
  } catch (error) {
    console.error(`[mail] Failed to send "${subject}" to ${to}:`, error);
  }
}

function summariseAccountsByTotal(
  lines: Array<{ isOptional: boolean; accounts: Array<{ label: string | null; bankName: string; accountNumber: string; accountName: string }>; lineTotal: number }>,
): Array<{ label: string | null; bankName: string; accountNumber: string; accountName: string; total: number }> {
  const byKey = new Map<string, { label: string | null; bankName: string; accountNumber: string; accountName: string; total: number }>();

  for (const line of lines) {
    for (const account of line.accounts) {
      const key = `${account.bankName}::${account.accountNumber}`;
      const row = byKey.get(key) ?? {
        label: account.label,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        total: 0,
      };
      row.total += line.lineTotal;
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function readLocalImage(filePath: string): Promise<Buffer | null> {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

async function resolveInvoiceLogoAsset(logoUrl?: string | null): Promise<Buffer | null> {
  const defaultLogoPath = path.resolve(process.cwd(), '../client/public/site/logo.png');

  if (!logoUrl) {
    return readLocalImage(defaultLogoPath);
  }

  if (logoUrl.startsWith('@file:')) {
    const rel = logoUrl.replace(/^@file:/, '').trim();
    const localPath = rel.startsWith('/') ? rel : path.resolve(process.cwd(), '..', rel);
    return readLocalImage(localPath) ?? readLocalImage(defaultLogoPath);
  }

  if (logoUrl.startsWith('/')) {
    const publicPath = path.resolve(process.cwd(), '../client/public', logoUrl.replace(/^\/+/, ''));
    const fromPublic = await readLocalImage(publicPath);
    if (fromPublic) return fromPublic;
  }

  const remote = await fetchImageBuffer(logoUrl);
  if (remote) return remote;

  return readLocalImage(defaultLogoPath);
}

async function buildInvoicePdfAttachment(params: {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  invoiceNo: string;
  issueDate: string;
  termName: string;
  sessionName: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  broughtForward: number;
  total: number;
  amountPaid: number;
  balance: number;
  note: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
    isOptional: boolean;
    accounts: Array<{ label: string | null; bankName: string; accountNumber: string; accountName: string }>;
  }>;
  accounts: Array<{ label: string; accountNumber: string; accountName: string }>;
}): Promise<Buffer> {
  return new Promise<Buffer>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'portrait' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const primary = '#1d4ed8';
    const dark = '#0f172a';
    const muted = '#64748b';
    const border = '#d1d5db';
    const panel = '#f8fafc';
    const accent = '#f59e0b';
    const danger = '#dc2626';
    const width = 595.28;
    const left = 50;
    const logoImage = await resolveInvoiceLogoAsset(params.schoolLogoUrl);

    doc.fillColor(primary).rect(0, 0, width, 78).fill();

    if (logoImage) {
      try {
        doc.image(logoImage, 18, 17, { fit: [42, 42] });
      } catch {
        // ignore invalid logo payloads
      }
    }

    const headerX = 72;
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(params.schoolName, headerX, 16, {
      width: 320,
    });
    if (params.schoolAddress) {
      doc.fillColor('#dbeafe').fontSize(9).font('Helvetica').text(params.schoolAddress, headerX, 44, {
        width: 320,
      });
    }
    if (params.schoolPhone || params.schoolEmail) {
      const contactLine = [params.schoolPhone, params.schoolEmail].filter(Boolean).join(' · ');
      doc.fillColor('#dbeafe').fontSize(8).font('Helvetica').text(contactLine, headerX, 58, {
        width: 340,
      });
    }

    doc.fillColor('#e0f2fe').fontSize(12).font('Helvetica-Bold').text('INVOICE', 430, 16, {
      align: 'right',
      width: 110,
    });
    doc.fillColor('#f8fafc').fontSize(9).font('Helvetica').text(params.invoiceNo, 420, 32, {
      align: 'right',
      width: 120,
    });

    doc.moveTo(left, 80).lineTo(width - left, 80).strokeColor(border).lineWidth(1).stroke();

    const contentStart = 98;
    doc.fillColor(dark).fontSize(12).font('Helvetica-Bold').text('BILLED TO', left, contentStart);
    doc.fillColor(dark).fontSize(12).font('Helvetica').text(params.studentName, left, contentStart + 20);
    doc.fillColor(muted).fontSize(10).text(`${params.admissionNo} · ${params.className ?? '—'}`, left, contentStart + 36);

    doc.fillColor(dark).fontSize(12).font('Helvetica-Bold').text('TERM', left + 210, contentStart, { width: 120 });
    doc.fillColor(dark).fontSize(12).font('Helvetica').text(`${params.termName} · ${params.sessionName}`, left + 210, contentStart + 20, { width: 140 });

    doc.fillColor(dark).fontSize(12).font('Helvetica-Bold').text('ISSUED', left + 350, contentStart, { width: 80 });
    doc.fillColor(dark).fontSize(12).font('Helvetica').text(formatInvoiceDate(params.issueDate), left + 350, contentStart + 20, { width: 100 });

    doc.fillColor(dark).fontSize(12).font('Helvetica-Bold').text('DUE', left + 440, contentStart, { width: 60 });
    doc.fillColor(dark).fontSize(12).font('Helvetica').text(formatInvoiceDate(params.dueDate), left + 440, contentStart + 20, { width: 90 });

    const tableY = 170;
    doc.fillColor(primary).rect(left, tableY, 495, 22).fill();
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('DESCRIPTION', left + 8, tableY + 7);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('AMOUNT', left + 390, tableY + 7, { align: 'right' });

    let y = tableY + 22;
    for (const line of params.lines) {
      const amountText = formatNaira(line.lineTotal);
      const descriptionText = line.description;
      const rows = [
        { text: descriptionText, color: dark },
      ];

      if (line.isOptional) {
        rows.push({ text: '(optional)', color: muted });
      }

      if (line.accounts.length > 0) {
        const accountText = `Pay into ${line.accounts
          .map((account) => `${account.label || account.bankName} — ${account.accountNumber} · ${account.accountName}`)
          .join(' | ')}`;
        rows.push({ text: accountText, color: muted });
      }

      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(descriptionText, left + 8, y + 8, { width: 320 });
      if (line.isOptional) {
        doc.fillColor(muted).fontSize(8).font('Helvetica').text('(optional)', left + 8, y + 22, { width: 100 });
      }
      if (line.accounts.length > 0) {
        doc.fillColor(muted).fontSize(8).font('Helvetica').text(
          line.accounts
            .map((account) => `${account.label || account.bankName} — ${account.accountNumber} · ${account.accountName}`)
            .join(' | '),
          left + 8,
          y + (line.isOptional ? 34 : 22),
          { width: 330 },
        );
      }

      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(amountText, left + 390, y + 8, {
        width: 90,
        align: 'right',
      });
      y += line.isOptional || line.accounts.length > 0 ? 50 : 28;
      doc.moveTo(left, y).lineTo(width - left, y).strokeColor(border).lineWidth(0.5).stroke();
      y += 10;
    }

    const totalsY = y + 8;
    doc.fillColor(dark).fontSize(10).font('Helvetica').text('Subtotal', left + 300, totalsY, { width: 90, align: 'right' });
    doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(formatNaira(params.subtotal), left + 390, totalsY, { width: 90, align: 'right' });

    if (params.discountTotal > 0) {
      doc.fillColor(dark).fontSize(10).font('Helvetica').text('Discount', left + 300, totalsY + 18, { width: 90, align: 'right' });
      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(`- ${formatNaira(params.discountTotal)}`, left + 390, totalsY + 18, { width: 90, align: 'right' });
    }

    if (params.broughtForward > 0) {
      doc.fillColor(dark).fontSize(10).font('Helvetica').text('Brought forward', left + 300, totalsY + 36, { width: 90, align: 'right' });
      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(formatNaira(params.broughtForward), left + 390, totalsY + 36, { width: 90, align: 'right' });
    }

    doc.fillColor(dark).fontSize(10).font('Helvetica').text('Total', left + 300, totalsY + 58, { width: 90, align: 'right' });
    doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(formatNaira(params.total), left + 390, totalsY + 58, { width: 90, align: 'right' });

    doc.fillColor(dark).fontSize(10).font('Helvetica').text('Paid', left + 300, totalsY + 76, { width: 90, align: 'right' });
    doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(formatNaira(params.amountPaid), left + 390, totalsY + 76, { width: 90, align: 'right' });

    doc.fillColor(accent).rect(left + 300, totalsY + 95, 190, 26).fill();
    doc.fillColor(dark).fontSize(10).font('Helvetica').text('Balance due', left + 310, totalsY + 103, { width: 90 });
    doc.fillColor(danger).fontSize(12).font('Helvetica-Bold').text(formatNaira(params.balance), left + 390, totalsY + 100, { width: 90, align: 'right' });

    const summaryY = totalsY + 150;
    doc.fillColor(panel).rect(left, summaryY, 495, 90).fill();
    doc.fillColor(primary).fontSize(10).font('Helvetica-Bold').text('PAYMENT SUMMARY', left + 10, summaryY + 12, { width: 160 });
    doc.fillColor(muted).fontSize(8).font('Helvetica').text("Pay each account's own total below in a single transfer.", left + 10, summaryY + 28, { width: 320 });

    let accountIndex = 0;
    let accountX = left + 12;
    let accountY = summaryY + 44;
    for (const account of summariseAccountsByTotal(params.lines)) {
      const boxWidth = 220;
      doc.fillColor('#ffffff').rect(accountX, accountY, boxWidth, 26).strokeColor(border).stroke();
      doc.fillColor(primary).fontSize(8).font('Helvetica-Bold').text(account.label || account.bankName, accountX + 8, accountY + 8, { width: 100 });
      doc.fillColor(muted).fontSize(7).font('Helvetica').text(`${account.bankName} · ${account.accountNumber} · ${account.accountName}`, accountX + 8, accountY + 18, { width: 150 });
      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text(formatNaira(account.total), accountX + 150, accountY + 8, { width: 60, align: 'right' });
      accountIndex += 1;
      if (accountIndex % 2 === 0) {
        accountX = left + 12;
        accountY += 34;
      } else {
        accountX += 240;
      }
    }

    doc.fillColor(muted).fontSize(8).font('Helvetica').text('Questions about this bill?', left + 10, summaryY + 100, { width: 150 });
    if (params.schoolPhone) {
      doc.fillColor(muted).fontSize(8).font('Helvetica').text(String(params.schoolPhone), left + 180, summaryY + 100, { width: 120 });
    }
    if (params.schoolEmail) {
      doc.fillColor(muted).fontSize(8).font('Helvetica').text(String(params.schoolEmail), left + 310, summaryY + 100, { width: 150 });
    }

    if (params.note) {
      doc.fillColor(muted).fontSize(8).font('Helvetica').text(params.note, left, 770, { width: 500 });
    }

    doc.end();
  });
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
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail?: string;
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  const { to, firstName, schoolName, schoolEmail, code, expiresInMinutes } = params;
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
    schoolEmail,
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
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
  childNames: string[];
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  const { to, firstName, schoolName, schoolEmail, childNames, code, expiresInMinutes } = params;
  const childList = childNames.length > 0 ? childNames.join(', ') : 'your child';
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const children = escapeHtml(childList);
  // Straight to the code box, not `/sign-in` — nobody has a password to sign
  // in with yet, and this is the page that gets them one. `email` rides in
  // the query string because this link opens in a fresh tab with no app
  // state behind it, unlike the in-app links that reach the same page.
  const verifyUrl = `${env.appUrl}/verify-email?email=${encodeURIComponent(to)}`;

  const body = [
    heading(`${school} has invited you to the parent portal`),
    paragraph(
      `Hello ${name}, you can now follow attendance, results, fees and messages for <strong>${children}</strong> online.`,
    ),
    paragraph('Enter this code to confirm your email address and set a password:'),
    codeBox(escapeHtml(code)),
    paragraph(`The code expires in ${expiresInMinutes} minutes.`),
    button('Confirm your email', verifyUrl),
    buttonFallback(verifyUrl),
    footnote(
      `If you were not expecting this, please contact ${school} directly — no account can be used until this code is entered.`,
    ),
  ].join('');

  await send({
    to,
    schoolEmail,
    subject: `Parent portal invitation — ${schoolName} — Scholaris`,
    html: emailLayout(body, `Follow attendance, results and fees for ${childList}.`),
    text: [
      `Hello ${firstName},`,
      '',
      `${schoolName} has invited you to the Scholaris parent portal for ${childList}.`,
      '',
      `Your code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      `Open ${verifyUrl} to confirm your address and set a password.`,
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
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail?: string;
}): Promise<void> {
  const { to, firstName, schoolName, schoolCode, schoolEmail } = params;
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
    schoolEmail,
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
  /**
   * The requester's own `schools.email`, when they belong to one — routes
   * this send, see `SendArgs.schoolEmail`. Unlike the other auth-flow
   * functions in this file, this one does route per-school: a school on the
   * Apps Script list gets its whole outbound mail, resets included, from that
   * one address.
   */
  schoolEmail?: string;
  resetUrl: string;
  expiresInHours: number;
}): Promise<void> {
  const { to, firstName, schoolEmail, resetUrl, expiresInHours } = params;
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
    schoolEmail,
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
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
  applications: { applicationNo: string; applicantName: string; className: string }[];
  contactEmail: string;
}): Promise<void> {
  const { to, firstName, schoolName, schoolEmail, applications, contactEmail } = params;
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
    schoolEmail,
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
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
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
  const { to, firstName, schoolName, schoolEmail, applicantName, applicationNo, status, note, contactEmail } =
    params;
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
    schoolEmail,
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

/** `Africa/Lagos` matches the timezone every school defaults to (see `RegistrationService`). */
function formatInterviewDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

/**
 * Recipient: the primary contact on an application. Trigger: staff setting or
 * changing an interview's date and time from the admissions screen. Tone:
 * transactional — no emoji.
 *
 * Sent only when a date is actually being set — recording pass/fail, or fixing
 * a typo in the venue after the fact, is an internal note the family has no
 * reason to be emailed about, unlike a date and time they need to show up for.
 */
export async function sendInterviewScheduledEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
  applicantName: string;
  applicationNo: string;
  interviewDate: string;
  interviewVenue?: string | null;
  note?: string | null;
  contactEmail: string;
}): Promise<void> {
  const {
    to,
    firstName,
    schoolName,
    schoolEmail,
    applicantName,
    applicationNo,
    interviewVenue,
    note,
    contactEmail,
  } = params;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const applicant = escapeHtml(applicantName);
  const when = formatInterviewDate(params.interviewDate);

  const rows: [string, string][] = [
    ['Applicant', applicant],
    ['Reference', escapeHtml(applicationNo)],
    ['Date and time', escapeHtml(when)],
  ];
  if (interviewVenue) rows.push(['Venue', escapeHtml(interviewVenue)]);

  const body = [
    heading('Interview scheduled'),
    paragraph(`Hello ${name}, <strong>${school}</strong> has scheduled an interview for ${applicant}.`),
    infoBox(rows),
    note ? paragraph(`<strong>A note from the school:</strong> ${escapeHtml(note)}`) : '',
    footnote(`Questions? Write to ${school} at ${escapeHtml(contactEmail)}.`),
  ].join('');

  await send({
    to,
    schoolEmail,
    subject: `Interview scheduled — ${schoolName} — Scholaris`,
    html: emailLayout(body, `${applicantName}'s interview is scheduled for ${when}.`),
    text: [
      `Hello ${firstName},`,
      '',
      `${schoolName} has scheduled an interview for ${applicantName}.`,
      '',
      `Applicant: ${applicantName}`,
      `Reference: ${applicationNo}`,
      `Date and time: ${when}`,
      ...(interviewVenue ? [`Venue: ${interviewVenue}`] : []),
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
 * Recipient: anyone who has turned Email on for a notification category, from
 * Notification settings in their profile. Trigger: `NotificationsService`
 * fans this out alongside the in-app row it already wrote, for whichever
 * category the event belongs to. Tone: matches whatever the notification
 * itself said.
 *
 * One template for every category rather than one per category — a fee
 * reminder, an attendance alert and a scheme-of-work approval all reach this
 * function the same way, carrying only a title and a body. That keeps a new
 * notification category from also needing a new email template; it costs
 * this template not being able to say anything category-specific.
 */
export async function sendNotificationEmail(params: {
  to: string;
  firstName: string;
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
  title: string;
  body: string;
  actionUrl?: string | null;
}): Promise<void> {
  const { to, firstName, schoolEmail, title, body: message, actionUrl } = params;
  const name = escapeHtml(firstName);
  const url = actionUrl ? `${env.appUrl}${actionUrl}` : null;

  const body = [
    heading(escapeHtml(title)),
    paragraph(`Hello ${name},`),
    paragraph(escapeHtml(message)),
    url ? button('Open in Scholaris', url) : '',
    url ? buttonFallback(url) : '',
    footnote(
      `You are receiving this by email because that is turned on for this notification category. Change that any time from Notification settings in your profile.`,
    ),
  ].join('');

  await send({
    to,
    schoolEmail,
    subject: `${title} — Scholaris`,
    html: emailLayout(body, title),
    text: [
      `Hello ${firstName},`,
      '',
      message,
      ...(url ? ['', `Open: ${url}`] : []),
      '',
      'You are receiving this by email because that is turned on for this notification category.',
    ].join('\n'),
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
 *
 * It tells a new employee about their job and nothing about the school's
 * account. What they need is where to sign in and what they were hired as.
 */
export async function sendStaffAccountEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail: string;
  designation: string;
  temporaryPassword: string;
}): Promise<void> {
  const { to, firstName, schoolName, schoolEmail, designation, temporaryPassword } = params;
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
    schoolEmail,
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

const formatNaira = (value: number) => `₦${value.toLocaleString('en-NG')}`;

/** Date-only, so an invoice's due date reads as a day, never a moment. */
function formatInvoiceDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

/**
 * Recipient: a guardian a bursar has chosen, by hand, to email one invoice
 * to. Trigger: `POST /invoices/:id/email`. Tone: transactional — no emoji.
 *
 * Carries no sign-in link and opens no account: the guardian receiving this
 * may never have a parent-portal login, and sending an invoice must never be
 * the thing that quietly creates one — `GuardiansService.invite` is the only
 * path that ever does that, and this function is not it. What it carries
 * instead is everything needed to act on the bill without signing in
 * anywhere: the amount, the due date, and where to pay it.
 */
export async function sendInvoiceEmail(params: {
  to: string;
  firstName: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolAddress: string;
  schoolPhone: string;
  /** The school's own `schools.email` — routes this send, see `SendArgs.schoolEmail`. */
  schoolEmail?: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  invoiceNo: string;
  issueDate: string;
  termName: string;
  sessionName: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  broughtForward: number;
  total: number;
  amountPaid: number;
  balance: number;
  note: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
    isOptional: boolean;
    accounts: Array<{ label: string | null; bankName: string; accountNumber: string; accountName: string }>;
  }>;
  accounts: { label: string; accountNumber: string; accountName: string }[];
  contactEmail: string;
}): Promise<void> {
  const {
    to,
    firstName,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolPhone,
    schoolEmail,
    studentName,
    admissionNo,
    className,
    invoiceNo,
    issueDate,
    termName,
    sessionName,
    dueDate,
    subtotal,
    discountTotal,
    broughtForward,
    total,
    amountPaid,
    balance,
    note,
    lines,
    accounts,
    contactEmail,
  } = params;
  const name = escapeHtml(firstName);
  const school = escapeHtml(schoolName);
  const student = escapeHtml(studentName);
  const term = escapeHtml(`${termName} · ${sessionName}`);
  const due = formatInvoiceDate(dueDate);

  const rows: [string, string][] = [
    ['Student', student],
    ['Term', term],
    ['Invoice', escapeHtml(invoiceNo)],
    ['Due date', escapeHtml(due)],
    ['Total', escapeHtml(formatNaira(total))],
    ['Balance due', escapeHtml(formatNaira(balance))],
  ];

  const invoicePdf = await buildInvoicePdfAttachment({
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolPhone,
    schoolEmail: schoolEmail ?? contactEmail,
    studentName,
    admissionNo,
    className,
    invoiceNo,
    issueDate,
    termName,
    sessionName,
    dueDate,
    subtotal,
    discountTotal,
    broughtForward,
    total,
    amountPaid,
    balance,
    note,
    lines,
    accounts,
  });

  const body = [
    heading(`Invoice ${escapeHtml(invoiceNo)}`),
    paragraph(`Hello ${name}, here is ${student}'s invoice for ${term} from <strong>${school}</strong>.`),
    infoBox(rows),
    balance > 0 && accounts.length > 0
      ? paragraph('Pay the balance into any one of these accounts:')
      : '',
    balance > 0 && accounts.length > 0
      ? infoBox(
          accounts.map((account) => [
            escapeHtml(account.label),
            escapeHtml(`${account.accountNumber} · ${account.accountName}`),
          ]),
        )
      : '',
    footnote(`Questions about this bill? Write to ${school} at ${escapeHtml(contactEmail)}.`),
  ].join('');

  await send({
    to,
    schoolEmail,
    subject: `Invoice ${invoiceNo} — ${schoolName} — Scholaris`,
    html: emailLayout(body, `${studentName}'s invoice for ${termName} is inside.`),
    attachments: [
      {
        filename: `invoice-${invoiceNo}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf',
      },
    ],
    text: [
      `Hello ${firstName},`,
      '',
      `Here is ${studentName}'s invoice for ${termName} · ${sessionName} from ${schoolName}.`,
      '',
      `Invoice: ${invoiceNo}`,
      `Due date: ${due}`,
      `Total: ${formatNaira(total)}`,
      `Balance due: ${formatNaira(balance)}`,
      ...(balance > 0 && accounts.length > 0
        ? [
            '',
            'Pay the balance into any one of these accounts:',
            ...accounts.map((account) => `${account.label}: ${account.accountNumber} · ${account.accountName}`),
          ]
        : []),
      '',
      `Questions? Write to ${schoolName} at ${contactEmail}.`,
    ].join('\n'),
  });
}
