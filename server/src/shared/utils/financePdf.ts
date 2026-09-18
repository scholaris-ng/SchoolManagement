import type PDFDocument from 'pdfkit';
import {
  formatPdfCurrency,
  renderPdf,
  resolveInvoiceLogoAsset,
  summariseAccountsByTotal,
} from './mailer';

/**
 * The two finance documents that have no PDF of their own from the email path —
 * a one-off bill and a fee schedule — drawn in the same letterhead as the
 * invoice and receipt PDFs in `mailer.ts`, so a family sees one family of
 * documents rather than four different ones.
 *
 * Only the WhatsApp share draws these. Neither has a recipient to email.
 */

type Doc = InstanceType<typeof PDFDocument>;

const PRIMARY = '#1d4ed8';
const DARK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#d1d5db';
const PANEL = '#f8fafc';
const ACCENT = '#f59e0b';

const PAGE_WIDTH = 595.28;
const LEFT = 50;
const CONTENT_WIDTH = 495;
/** Text drawn past here makes PDFKit open a page mid-layout; see the invoice builder. */
const PAGE_BOTTOM = 780;
const NEW_PAGE_TOP = 50;

interface PdfAccount {
  label: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface Letterhead {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
  title: string;
  reference: string;
}

async function drawLetterhead(doc: Doc, head: Letterhead): Promise<void> {
  const logo = await resolveInvoiceLogoAsset(head.schoolLogoUrl);

  doc.fillColor(PRIMARY).rect(0, 0, PAGE_WIDTH, 78).fill();
  if (logo) {
    try {
      doc.image(logo, 18, 17, { fit: [42, 42] });
    } catch {
      // An unusable logo costs the document its crest, not the document.
    }
  }

  doc
    .fillColor('#ffffff')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(head.schoolName, 72, 16, { width: 300, height: 24, ellipsis: true });

  const contact = [head.schoolPhone, head.schoolEmail].filter(Boolean).join(' · ');
  if (contact) {
    doc.fillColor('#dbeafe').fontSize(8).font('Helvetica').text(contact, 72, 58, { width: 300 });
  }

  doc
    .fillColor('#e0f2fe')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(head.title, 380, 16, { align: 'right', width: 160 });
  doc
    .fillColor('#f8fafc')
    .fontSize(9)
    .font('Helvetica')
    .text(head.reference, 380, 32, { align: 'right', width: 160, height: 12, ellipsis: true });
}

/** Moves to a fresh page when `needed` will not fit under `y`, and returns where to draw next. */
function ensureSpace(doc: Doc, y: number, needed: number): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return NEW_PAGE_TOP;
}

interface TableRow {
  title: string;
  /** Small grey lines under the title — "(optional)", "Pay into …". */
  details: string[];
  amount: string;
}

/** A row's height is measured, not assumed: a long description or several accounts wrap. */
function drawTable(
  doc: Doc,
  startY: number,
  labels: { description: string; amount: string },
  rows: TableRow[],
): number {
  doc.fillColor(PRIMARY).rect(LEFT, startY, CONTENT_WIDTH, 22).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(labels.description, LEFT + 8, startY + 7);
  doc.text(labels.amount, LEFT + 390, startY + 7, { width: 90, align: 'right' });

  let y = startY + 22;
  for (const row of rows) {
    const titleHeight = doc.fontSize(10).font('Helvetica-Bold').heightOfString(row.title, { width: 320 });
    const detailHeights = row.details.map((text) =>
      doc.fontSize(8).font('Helvetica').heightOfString(text, { width: 330 }),
    );
    const detailsTotal = detailHeights.reduce((sum, h) => sum + h + 2, 0);
    const rowHeight = 8 + titleHeight + detailsTotal + 8;

    y = ensureSpace(doc, y, rowHeight);

    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(row.title, LEFT + 8, y + 8, { width: 320 });
    doc.text(row.amount, LEFT + 390, y + 8, { width: 90, align: 'right' });

    let detailY = y + 8 + titleHeight + 2;
    row.details.forEach((text, index) => {
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(text, LEFT + 8, detailY, { width: 330 });
      detailY += detailHeights[index] + 2;
    });

    y += rowHeight;
    doc.moveTo(LEFT, y).lineTo(PAGE_WIDTH - LEFT, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 4;
  }
  return y;
}

/** Figures stacked under each other and right-aligned, the last one boxed as the headline. */
function drawTotals(
  doc: Doc,
  startY: number,
  rows: { label: string; value: string }[],
  headline: { label: string; value: string },
): number {
  let y = ensureSpace(doc, startY + 8, rows.length * 18 + 40);
  for (const row of rows) {
    doc.fillColor(DARK).fontSize(10).font('Helvetica').text(row.label, LEFT + 200, y, { width: 190, align: 'right' });
    doc.font('Helvetica-Bold').text(row.value, LEFT + 390, y, { width: 105, align: 'right' });
    y += 18;
  }
  y += 4;
  doc.fillColor(ACCENT).rect(LEFT + 250, y, 245, 26).fill();
  doc.fillColor(DARK).fontSize(10).font('Helvetica').text(headline.label, LEFT + 260, y + 8, { width: 120 });
  doc.fontSize(12).font('Helvetica-Bold').text(headline.value, LEFT + 380, y + 5, { width: 105, align: 'right' });
  return y + 26 + 20;
}

/**
 * Bank accounts in a shaded panel, one full-width box each. `total` is shown on
 * the right when the account has its own figure to pay (a fee schedule);
 * absent, the accounts are alternatives for one total (a bill).
 */
function drawAccountsPanel(
  doc: Doc,
  startY: number,
  heading: string,
  caption: string,
  accounts: (PdfAccount & { total?: number })[],
): number {
  if (accounts.length === 0) return startY;

  const boxHeight = 30;
  const panelHeight = 46 + accounts.length * (boxHeight + 6) + 6;
  // A long list is allowed to run over a page, so only the first box has to fit.
  let y = ensureSpace(doc, startY, Math.min(panelHeight, 46 + boxHeight + 12));

  doc.fillColor(PANEL).rect(LEFT, y, CONTENT_WIDTH, Math.min(panelHeight, PAGE_BOTTOM - y)).fill();
  doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold').text(heading, LEFT + 10, y + 12, { width: 300 });
  doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(caption, LEFT + 10, y + 28, { width: 470 });
  y += 46;

  for (const account of accounts) {
    if (y + boxHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = NEW_PAGE_TOP;
    }
    doc.fillColor('#ffffff').rect(LEFT + 12, y, CONTENT_WIDTH - 24, boxHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc
      .fillColor(PRIMARY)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(account.label || account.bankName, LEFT + 20, y + 6, { width: 300, height: 11, ellipsis: true });
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text(`${account.bankName} · ${account.accountNumber} · ${account.accountName}`, LEFT + 20, y + 18, {
        width: 330,
        height: 10,
        ellipsis: true,
      });
    if (account.total !== undefined) {
      doc
        .fillColor(DARK)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(formatPdfCurrency(account.total), LEFT + 360, y + 10, { width: 115, align: 'right' });
    }
    y += boxHeight + 6;
  }
  return y + 6;
}

/** The typed-in note: bold, as it appears on the printed page. */
function drawNote(doc: Doc, startY: number, note: string | null | undefined): number {
  const text = note?.trim();
  if (!text) return startY;
  const height = doc.fontSize(9).font('Helvetica-Bold').heightOfString(text, { width: CONTENT_WIDTH - 14 });
  const y = ensureSpace(doc, startY, height + 16);
  doc.fillColor(ACCENT).rect(LEFT, y, 3, height + 10).fill();
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(text, LEFT + 12, y + 5, { width: CONTENT_WIDTH - 14 });
  return y + height + 10 + 14;
}

function drawQuestions(doc: Doc, startY: number, prompt: string, phone?: string, email?: string): void {
  const contact = [phone, email].filter(Boolean).join(' · ');
  if (!contact) return;
  const y = ensureSpace(doc, startY, 24);
  doc.moveTo(LEFT, y).lineTo(PAGE_WIDTH - LEFT, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font('Helvetica')
    .text(`${prompt}  ${contact}`, LEFT, y + 8, { width: CONTENT_WIDTH, align: 'center' });
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

/* -- A one-off bill ------------------------------------------------------------ */

export interface CustomBillPdfParams {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
  payerName: string;
  createdAt: string;
  lines: { description: string; amount: number; quantity: number }[];
  total: number;
  note: string | null;
  /** Any one of these settles the whole total. */
  accounts: PdfAccount[];
}

export function buildCustomBillPdf(params: CustomBillPdfParams): Promise<Buffer> {
  return renderPdf(async (doc) => {
    await drawLetterhead(doc, {
      schoolName: params.schoolName,
      schoolLogoUrl: params.schoolLogoUrl,
      schoolPhone: params.schoolPhone,
      schoolEmail: params.schoolEmail,
      title: 'BILL',
      reference: formatDay(params.createdAt),
    });

    doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('BILL TO', LEFT, 98);
    doc.font('Helvetica').fontSize(12).text(params.payerName, LEFT, 118, { width: CONTENT_WIDTH });
    const payerHeight = doc.fontSize(12).font('Helvetica').heightOfString(params.payerName, { width: CONTENT_WIDTH });

    let y = drawTable(
      doc,
      118 + payerHeight + 18,
      { description: 'DESCRIPTION', amount: 'AMOUNT' },
      params.lines.map((line) => ({
        title: line.description,
        details:
          line.quantity > 1 ? [`${line.quantity} × ${formatPdfCurrency(line.amount)} each`] : [],
        amount: formatPdfCurrency(line.amount * line.quantity),
      })),
    );

    y = drawTotals(doc, y, [], { label: 'Total', value: formatPdfCurrency(params.total) });
    y = drawAccountsPanel(
      doc,
      y,
      'PAYMENT ACCOUNTS',
      'Pay the total above into any one of these accounts.',
      params.accounts,
    );
    y = drawNote(doc, y, params.note);
    drawQuestions(doc, y, 'Questions about this bill?', params.schoolPhone, params.schoolEmail);
  });
}

/* -- A fee schedule ------------------------------------------------------------ */

export interface FeeSchedulePdfParams {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
  name: string;
  /** "2025/2026 Session · First Term · All levels". */
  scopeLine: string;
  lines: { feeItemName: string; amount: number; isOptional: boolean; accounts: PdfAccount[] }[];
  mandatoryTotal: number;
  optionalTotal: number;
  note: string | null;
}

export function buildFeeSchedulePdf(params: FeeSchedulePdfParams): Promise<Buffer> {
  return renderPdf(async (doc) => {
    await drawLetterhead(doc, {
      schoolName: params.schoolName,
      schoolLogoUrl: params.schoolLogoUrl,
      schoolPhone: params.schoolPhone,
      schoolEmail: params.schoolEmail,
      title: 'FEE SCHEDULE',
      reference: params.name,
    });

    doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text(params.name, LEFT, 98, { width: CONTENT_WIDTH });
    const nameHeight = doc.fontSize(12).font('Helvetica-Bold').heightOfString(params.name, { width: CONTENT_WIDTH });
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(params.scopeLine, LEFT, 98 + nameHeight + 4, {
      width: CONTENT_WIDTH,
    });
    const scopeHeight = doc.fontSize(10).font('Helvetica').heightOfString(params.scopeLine, { width: CONTENT_WIDTH });

    let y = drawTable(
      doc,
      98 + nameHeight + 4 + scopeHeight + 18,
      { description: 'CHARGE', amount: 'AMOUNT' },
      params.lines.map((line) => ({
        title: line.feeItemName,
        details: [
          ...(line.isOptional ? ['(optional)'] : []),
          ...line.accounts.map(
            (account) =>
              `Pay into ${account.label ? `${account.label} — ` : ''}${account.bankName} · ${account.accountNumber} · ${account.accountName}`,
          ),
        ],
        amount: formatPdfCurrency(line.amount),
      })),
    );

    y = drawTotals(
      doc,
      y,
      params.optionalTotal > 0
        ? [{ label: 'Optional, on top', value: `+ ${formatPdfCurrency(params.optionalTotal)}` }]
        : [],
      { label: 'Every pupil in scope', value: formatPdfCurrency(params.mandatoryTotal) },
    );

    // Only worth its own panel once there is more than one account to add up —
    // with a single account the total just above already says it.
    const perAccount = summariseAccountsByTotal(
      params.lines.map((line) => ({
        isOptional: line.isOptional,
        accounts: line.accounts,
        lineTotal: line.amount,
      })),
    );
    if (perAccount.length > 1) {
      y = drawAccountsPanel(
        doc,
        y,
        'PAYMENT SUMMARY',
        "Pay each account's own total below in a single transfer.",
        perAccount,
      );
    }

    y = drawNote(doc, y, params.note);
    drawQuestions(doc, y, 'Questions about this schedule?', params.schoolPhone, params.schoolEmail);
  });
}
