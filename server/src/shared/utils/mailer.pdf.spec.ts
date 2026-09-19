import fs from 'node:fs';
import path from 'node:path';
import type { MailMessage } from '../mail/types';

const sent: MailMessage[] = [];
// What the mocked transport does next: deliver, fail, or not exist at all.
let transport: 'deliver' | 'fail' | 'none' = 'deliver';

jest.mock('../mail/router', () => ({
  resolveProvider: () =>
    transport === 'none'
      ? null
      : {
          send: async (message: MailMessage) => {
            if (transport === 'fail') throw new Error('SMTP down');
            sent.push(message);
          },
        },
}));

// Imported after the mock so `send()` resolves the capturing provider.
import { sendInvoiceEmail, sendReceiptEmail } from './mailer';

/** Set to a folder to keep the rendered PDFs for looking at by eye. */
const OUT_DIR = process.env.PDF_OUT_DIR;

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

function attachment(): Buffer {
  const file = sent[sent.length - 1]?.attachments?.[0];
  if (!file) throw new Error('No attachment was sent');
  return Buffer.from(file.content);
}

function keep(name: string, pdf: Buffer) {
  if (!OUT_DIR) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), pdf);
}

const account = {
  label: 'School fees',
  bankName: 'Access Bank',
  accountNumber: '1808692521',
  accountName: 'AB.10 School',
};

function invoiceParams(lineCount: number, overrides: Record<string, unknown> = {}) {
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    description: `Charge number ${index + 1}`,
    quantity: 1,
    unitAmount: 25_000,
    lineTotal: 25_000,
    isOptional: index % 4 === 0,
    accounts: [account],
  }));
  return {
    to: 'parent@example.com',
    firstName: 'Ada',
    schoolName: 'AB.10 Schools',
    schoolLogoUrl: null,
    schoolAddress: '3/5, Idowu Str, Karaole Estate, College Road, Ifako-Ijaiye, Ikeja, Lagos',
    schoolPhone: '+2348063219815',
    schoolEmail: 'ab.10high@gmail.com',
    studentName: 'Lotanna Ohanyere',
    admissionNo: 'A1S/2026/0003',
    className: 'SS 2',
    invoiceNo: 'INV/2026-2027/00003',
    issueDate: '2026-09-18',
    termName: 'First Term',
    sessionName: '2026/2027',
    dueDate: '2026-10-05',
    subtotal: lineCount * 25_000,
    discountTotal: 0,
    broughtForward: 0,
    total: lineCount * 25_000,
    amountPaid: 0,
    balance: lineCount * 25_000,
    note: 'Payment is due within 14 days.',
    lines,
    accounts: [{ label: account.label, accountNumber: account.accountNumber, accountName: account.accountName }],
    contactEmail: 'ab.10high@gmail.com',
    ...overrides,
  };
}

function receiptParams(overrides: Record<string, unknown> = {}) {
  return {
    to: 'parent@example.com',
    firstName: 'Ada',
    schoolName: 'AB.10 Schools',
    schoolLogoUrl: null,
    schoolAddress: '3/5, Idowu Str, Karaole Estate, College Road, Ifako-Ijaiye, Ikeja, Lagos',
    schoolPhone: '+2348063219815',
    schoolEmail: 'ab.10high@gmail.com',
    studentName: 'Lotanna Ohanyere',
    admissionNo: 'A1S/2026/0003',
    className: 'SS 2',
    receiptNo: 'PAY-20260918-2D45DF',
    paymentId: '11111111-1111-1111-1111-111111111111',
    amount: 327_500,
    amountInWords: 'Three Hundred And Twenty-Seven Thousand Five Hundred Naira Only',
    method: 'Bank transfer',
    paidAt: '2026-09-02T00:00:00.000Z',
    receivedByName: 'Oyeyemi Adeshina',
    allocations: [
      {
        invoiceNo: 'INV/2026-2027/00003',
        description: 'First Term · 2026/2027 fees',
        amount: 327_500,
        invoiceTotal: 350_000,
        lines: [
          { description: 'Tuition', isOptional: false, amount: 250_000 },
          { description: 'Transport', isOptional: true, amount: 77_500 },
        ],
      },
    ],
    balanceAfter: 0,
    verificationCode: 'E4520DCEB0',
    contactEmail: 'ab.10high@gmail.com',
    includeCharges: true,
    ...overrides,
  };
}

describe('emailed PDFs', () => {
  beforeEach(() => {
    sent.length = 0;
    transport = 'deliver';
  });

  it('reports a failed delivery instead of pretending the invoice went out', async () => {
    transport = 'fail';
    await expect(sendInvoiceEmail(invoiceParams(2))).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_FAILED',
    });
  });

  it('reports that email is not configured instead of pretending the receipt went out', async () => {
    transport = 'none';
    await expect(sendReceiptEmail(receiptParams())).rejects.toMatchObject({
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });

  it('renders a short invoice as one PDF page', async () => {
    await sendInvoiceEmail(invoiceParams(3));
    const pdf = attachment();
    keep('invoice-short.pdf', pdf);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
    expect(sent[0].attachments?.[0].filename).toBe('invoice-INV/2026-2027/00003.pdf');
  });

  it('runs a long invoice onto more pages instead of losing its totals off the bottom', async () => {
    await sendInvoiceEmail(invoiceParams(40, { discountTotal: 10_000, broughtForward: 50_000 }));
    const pdf = attachment();
    keep('invoice-long.pdf', pdf);

    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it('fails, rather than hangs, when the PDF cannot be drawn', async () => {
    await expect(sendInvoiceEmail(invoiceParams(2, { issueDate: 'not-a-date' }))).rejects.toThrow();
    expect(sent).toHaveLength(0);
  }, 5_000);

  describe('school logo handling', () => {
    afterEach(() => jest.restoreAllMocks());

    it('never fetches a logo hosted on an internal address, and still sends', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      for (const host of ['http://127.0.0.1/logo.png', 'http://localhost/logo.png', 'http://169.254.169.254/x.png', 'http://10.0.0.5/a.png', 'http://192.168.1.9/a.png', 'http://[::1]/a.png']) {
        await sendInvoiceEmail(invoiceParams(1, { schoolLogoUrl: host }));
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(sent).toHaveLength(6);
    });

    it('falls back to the default logo when the URL is not an image', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      );
      await sendInvoiceEmail(invoiceParams(1, { schoolLogoUrl: 'https://cdn.example.com/logo.png' }));
      expect(pageCount(attachment())).toBe(1);
    });

    it('does not follow a path out of the public folder', async () => {
      const readSpy = jest.spyOn(fs.promises, 'readFile');
      await sendInvoiceEmail(invoiceParams(1, { schoolLogoUrl: '/../../server/package.json' }));
      const readPaths = readSpy.mock.calls.map(([file]) => String(file));
      expect(readPaths.some((file) => file.endsWith('package.json'))).toBe(false);
      expect(sent).toHaveLength(1);
    });
  });

  it('renders a receipt with its charges as a PDF', async () => {
    await sendReceiptEmail(receiptParams());
    const pdf = attachment();
    keep('receipt.pdf', pdf);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('runs a receipt with many allocations onto more pages', async () => {
    const allocations = Array.from({ length: 30 }, (_, index) => ({
      invoiceNo: `INV/2026-2027/${String(index + 1).padStart(5, '0')}`,
      description: 'First Term · 2026/2027 fees',
      amount: 10_000,
      invoiceTotal: 10_000,
      lines: [
        { description: 'Tuition', isOptional: false, amount: 8_000 },
        { description: 'Exam', isOptional: false, amount: 2_000 },
      ],
    }));
    await sendReceiptEmail(receiptParams({ amount: 300_000, allocations }));
    const pdf = attachment();
    keep('receipt-long.pdf', pdf);

    expect(pageCount(pdf)).toBeGreaterThan(1);
  });
});
