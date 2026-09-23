import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Payment } from '@/types/finance';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const reverse = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as unknown,
}));
vi.mock('./use-payments', () => ({ useReversePayment: () => reverse }));

import { ReversePaymentDialog, isReversible } from './reverse-payment-dialog';

const payment: Payment = {
  id: 'pay-1',
  schoolId: 'school-1',
  reference: 'PAY-20260919-3F9A2C',
  studentId: 'stu-1',
  studentName: 'Ada Okafor',
  admissionNo: 'ADM-001',
  amount: 50000,
  method: 'CASH',
  provider: 'MANUAL',
  status: 'SUCCESSFUL',
  paidAt: '2026-09-19T09:00:00.000Z',
  allocations: [{ id: 'al-1', invoiceId: 'inv-1', invoiceNo: 'INV-2026-0007', amount: 50000 }],
  unallocatedAmount: 0,
  isReconciled: false,
  receiptNo: 'PAY-20260919-3F9A2C',
  receiptSentCount: 0,
};

describe('ReversePaymentDialog', () => {
  beforeEach(() => {
    navigate.mockClear();
    reverse.mutateAsync.mockReset().mockResolvedValue(payment);
    reverse.reset.mockClear();
    reverse.error = null;
  });
  afterEach(cleanup);

  it('will not reverse until a reason has been given', async () => {
    render(<ReversePaymentDialog payment={payment} onOpenChange={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Reverse payment' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'ab');
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'c');
    expect(confirm).toBeEnabled();
  });

  it('names the invoice that will be owed again', () => {
    render(<ReversePaymentDialog payment={payment} onOpenChange={vi.fn()} />);
    expect(screen.getByText('INV-2026-0007')).toBeInTheDocument();
  });

  it('sends the trimmed reason and closes, without leaving the page', async () => {
    const onOpenChange = vi.fn();
    render(<ReversePaymentDialog payment={payment} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Reason'), '  Typed 50000 instead of 5000  ');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));

    await waitFor(() =>
      expect(reverse.mutateAsync).toHaveBeenCalledWith({
        id: 'pay-1',
        reason: 'Typed 50000 instead of 5000',
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Reverse & record again" opens the payment form for the same student', async () => {
    render(<ReversePaymentDialog payment={payment} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Reason'), 'Wrong amount');
    await userEvent.click(screen.getByRole('button', { name: /reverse & record again/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/finance/payments/new?studentId=stu-1'),
    );
  });

  it('stays open, and does not navigate, when the server refuses', async () => {
    reverse.mutateAsync.mockRejectedValue(new Error('already reconciled'));
    const onOpenChange = vi.fn();
    render(<ReversePaymentDialog payment={payment} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Reason'), 'Wrong amount');
    await userEvent.click(screen.getByRole('button', { name: /reverse & record again/i }));

    await waitFor(() => expect(reverse.mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows nothing when there is no payment to reverse', () => {
    render(<ReversePaymentDialog payment={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('isReversible', () => {
  it('allows an unreconciled desk payment', () => {
    expect(isReversible(payment)).toBe(true);
  });

  it.each([
    ['already reversed', { status: 'REVERSED' as const }],
    ['a bank (Raven) credit', { provider: 'RAVEN' as const }],
    ['already reconciled', { isReconciled: true }],
  ])('refuses a payment that is %s', (_label, override) => {
    expect(isReversible({ ...payment, ...override })).toBe(false);
  });
});
