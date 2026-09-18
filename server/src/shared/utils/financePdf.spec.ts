import fs from 'node:fs';
import path from 'node:path';
import { buildCustomBillPdf, buildFeeSchedulePdf } from './financePdf';

/** Set to a folder to keep the rendered PDFs for looking at by eye. */
const OUT_DIR = process.env.PDF_OUT_DIR;

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

function keep(name: string, pdf: Buffer) {
  if (!OUT_DIR) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), pdf);
}

const account = (n: number) => ({
  label: n % 2 === 0 ? 'School fees' : null,
  bankName: 'Access Bank',
  accountNumber: `18086925${20 + n}`,
  accountName: 'AB.10 School',
});

function billParams(lineCount: number, accountCount = 2, overrides: Record<string, unknown> = {}) {
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    description: `Hall hire, day ${index + 1}`,
    amount: 25_000,
    quantity: index % 3 === 0 ? 2 : 1,
  }));
  return {
    schoolName: 'AB.10 Schools',
    schoolLogoUrl: null,
    schoolPhone: '08063219815',
    schoolEmail: 'bursar@ab10.example',
    payerName: 'Mr Emeka Okafor',
    createdAt: '2026-08-22T09:00:00Z',
    lines,
    total: lines.reduce((sum, line) => sum + line.amount * line.quantity, 0),
    note: 'Please pay before the 3rd week.',
    accounts: Array.from({ length: accountCount }, (_, n) => account(n)),
    ...overrides,
  };
}

function scheduleParams(lineCount: number, accountCount = 2, overrides: Record<string, unknown> = {}) {
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    feeItemName: `Charge number ${index + 1}`,
    amount: 30_000,
    isOptional: index % 4 === 0,
    accounts: Array.from({ length: accountCount }, (_, n) => account((index + n) % 3)),
  }));
  return {
    schoolName: 'AB.10 Schools',
    schoolLogoUrl: null,
    schoolPhone: '08063219815',
    schoolEmail: 'bursar@ab10.example',
    name: 'Primary 1 to 3 — First Term',
    scopeLine: '2026/2027 Session · First Term · Primary 1, Primary 2, Primary 3',
    lines,
    mandatoryTotal: lines.filter((line) => !line.isOptional).length * 30_000,
    optionalTotal: lines.filter((line) => line.isOptional).length * 30_000,
    note: null,
    ...overrides,
  };
}

describe('custom bill PDF', () => {
  it('renders a short bill as one PDF page', async () => {
    const pdf = await buildCustomBillPdf(billParams(3));
    keep('bill-short.pdf', pdf);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('runs a long bill onto more pages instead of losing its total off the bottom', async () => {
    const pdf = await buildCustomBillPdf(billParams(45, 6));
    keep('bill-long.pdf', pdf);

    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it('draws a bill with no accounts and no note', async () => {
    const pdf = await buildCustomBillPdf(billParams(2, 0, { note: null }));
    expect(pageCount(pdf)).toBe(1);
  });

  it('copes with a very long payer name', async () => {
    const pdf = await buildCustomBillPdf(billParams(2, 1, { payerName: 'The Board of Governors of '.repeat(8) }));
    keep('bill-long-name.pdf', pdf);
    expect(pageCount(pdf)).toBe(1);
  });

  it('fails, rather than hangs, when the PDF cannot be drawn', async () => {
    await expect(buildCustomBillPdf(billParams(2, 1, { createdAt: 'not-a-date' }))).rejects.toThrow();
  }, 5_000);
});

describe('fee schedule PDF', () => {
  it('renders a short schedule as one PDF page', async () => {
    const pdf = await buildFeeSchedulePdf(scheduleParams(4));
    keep('schedule-short.pdf', pdf);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('runs a long schedule onto more pages', async () => {
    const pdf = await buildFeeSchedulePdf(scheduleParams(40, 3, { note: 'Payments close in the 3rd week.' }));
    keep('schedule-long.pdf', pdf);

    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it('draws a schedule whose charges name no account', async () => {
    const pdf = await buildFeeSchedulePdf(scheduleParams(3, 0));
    expect(pageCount(pdf)).toBe(1);
  });

  it('draws the typed note', async () => {
    const pdf = await buildFeeSchedulePdf(scheduleParams(3, 1, { note: 'Pay by the 3rd week.' }));
    keep('schedule-note.pdf', pdf);
    expect(pageCount(pdf)).toBe(1);
  });
});
