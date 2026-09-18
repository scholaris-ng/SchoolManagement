import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PosReceipt } from './receipt-pos';
import type { Receipt } from '@/types/finance';

const receipt: Receipt = {
  id: 'r1',
  receiptNo: 'PAY-20260918-2D45DF',
  paymentId: 'p1',
  studentId: 's1',
  schoolName: 'AB.10 Schools',
  schoolLogoUrl: null,
  schoolAddress: '3/5, Idowu Str, Ikeja, Lagos',
  studentName: 'Lotanna Ohanyere',
  admissionNo: 'A1S/2026/0003',
  className: 'SS 2',
  amount: 327_500,
  amountInWords: 'Three Hundred And Twenty-Seven Thousand Five Hundred Naira Only',
  method: 'BANK_TRANSFER',
  paidAt: '2026-09-02T00:00:00.000Z',
  receivedByName: 'Oyeyemi Adeshina',
  allocations: [
    {
      invoiceNo: 'INV/2026-2027/00003',
      description: 'First Term · 2026/2027 fees',
      amount: 327_500,
      lines: [
        { description: 'Tuition', isOptional: false, amount: 250_000 },
        { description: 'Transport', isOptional: true, amount: 77_500 },
      ],
    },
  ],
  balanceAfter: 0,
  verificationCode: 'E4520DCEB0',
};

const verifyUrl = 'http://localhost:5173/verify/E4520DCEB0';

describe('PosReceipt', () => {
  afterEach(cleanup);

  // The QR code encodes asynchronously; waiting for it keeps each test from
  // ending mid-update.
  const qrReady = () => screen.findByRole('img', { name: 'Scan to verify this receipt' });

  it('renders straight into the body, outside the page it is printed from', async () => {
    const { container } = render(<PosReceipt record={receipt} verifyUrl={verifyUrl} showItems={false} />);

    await qrReady();
    // Nothing lands in the test container: it is a portal to `document.body`,
    // so no page padding or container width can narrow it on paper.
    expect(container).toBeEmptyDOMElement();
    const root = document.body.querySelector('.pos-receipt-root') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.parentElement).toBe(document.body);
    expect(root.style.width).toBe('78mm');
  });

  it('carries everything a customer needs on the slip', async () => {
    render(<PosReceipt record={receipt} verifyUrl={verifyUrl} showItems={false} />);
    await qrReady();
    const slip = within(document.body.querySelector('.pos-receipt-root') as HTMLElement);

    expect(slip.getByText('AB.10 Schools')).toBeInTheDocument();
    expect(slip.getByText('PAY-20260918-2D45DF')).toBeInTheDocument();
    expect(slip.getByText('Lotanna Ohanyere')).toBeInTheDocument();
    expect(slip.getByText('A1S/2026/0003')).toBeInTheDocument();
    expect(slip.getByText(/327,500\.00/)).toBeInTheDocument();
    expect(slip.getByText('INV/2026-2027/00003')).toBeInTheDocument();
    expect(slip.getByText('E4520DCEB0')).toBeInTheDocument();
    expect(slip.getByText(verifyUrl)).toBeInTheDocument();
  });

  it('lists each invoice’s charges only when asked to', async () => {
    const { rerender } = render(<PosReceipt record={receipt} verifyUrl={verifyUrl} showItems={false} />);
    await qrReady();
    expect(screen.queryByText('Tuition')).not.toBeInTheDocument();

    rerender(<PosReceipt record={receipt} verifyUrl={verifyUrl} showItems />);
    expect(screen.getByText('Tuition')).toBeInTheDocument();
    expect(screen.getByText(/Transport \(opt\.\)/)).toBeInTheDocument();
  });
});
