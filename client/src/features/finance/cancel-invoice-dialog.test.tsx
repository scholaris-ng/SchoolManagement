import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Invoice } from '@/types/finance';

const cancel = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as unknown,
}));
vi.mock('./api', () => ({ useCancelInvoice: () => cancel }));

import { CancelInvoiceDialog, isCancellable } from './cancel-invoice-dialog';

const invoice = {
  id: 'inv-21',
  invoiceNo: 'INV/2026-2027/00021',
  studentName: 'Chukwuemeka Umeh',
  status: 'ISSUED',
  total: 90_000,
  amountPaid: 0,
  carriedFrom: [{ invoiceId: 'inv-20', invoiceNo: 'INV/2026-2027/00020', amount: 90_000, items: [], unassigned: 0 }],
} as unknown as Invoice;

describe('CancelInvoiceDialog', () => {
  beforeEach(() => {
    cancel.mutateAsync.mockReset().mockResolvedValue(invoice);
    cancel.reset.mockClear();
    cancel.error = null;
  });
  afterEach(cleanup);

  it('will not cancel until a reason has been given', async () => {
    render(<CancelInvoiceDialog invoice={invoice} onOpenChange={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Cancel invoice' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'ab');
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'c');
    expect(confirm).toBeEnabled();
  });

  it('says which earlier invoice will be owed again on its own', () => {
    render(<CancelInvoiceDialog invoice={invoice} onOpenChange={vi.fn()} />);

    expect(screen.getByText('INV/2026-2027/00020')).toBeInTheDocument();
    expect(screen.getByText(/reopens/)).toBeInTheDocument();
  });

  it('has nothing to say about reopening when the invoice took nothing over', () => {
    render(
      <CancelInvoiceDialog invoice={{ ...invoice, carriedFrom: [] } as Invoice} onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByText(/reopens/)).not.toBeInTheDocument();
  });

  it('sends the trimmed reason and closes', async () => {
    const onOpenChange = vi.fn();
    render(<CancelInvoiceDialog invoice={invoice} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Reason'), '  Replacing it with an itemized one  ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel invoice' }));

    await waitFor(() =>
      expect(cancel.mutateAsync).toHaveBeenCalledWith({
        id: 'inv-21',
        reason: 'Replacing it with an itemized one',
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the server refuses', async () => {
    cancel.mutateAsync.mockRejectedValue(new Error('Money has already been received'));
    const onOpenChange = vi.fn();
    render(<CancelInvoiceDialog invoice={invoice} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Reason'), 'Wrong bill');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel invoice' }));

    await waitFor(() => expect(cancel.mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps the invoice, without calling the server, when backed out of', async () => {
    const onOpenChange = vi.fn();
    render(<CancelInvoiceDialog invoice={invoice} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Keep invoice' }));

    expect(cancel.mutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows nothing when there is no invoice to cancel', () => {
    render(<CancelInvoiceDialog invoice={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('isCancellable', () => {
  it('allows an invoice nobody has paid anything towards', () => {
    expect(isCancellable({ status: 'ISSUED', amountPaid: 0 })).toBe(true);
    expect(isCancellable({ status: 'OVERDUE', amountPaid: 0 })).toBe(true);
  });

  it.each([
    ['already cancelled', { status: 'CANCELLED' as const, amountPaid: 0 }],
    ['paid in full', { status: 'PAID' as const, amountPaid: 50_000 }],
    ['part-paid', { status: 'PART_PAID' as const, amountPaid: 10_000 }],
  ])('refuses one that is %s', (_label, state) => {
    expect(isCancellable(state)).toBe(false);
  });
});
