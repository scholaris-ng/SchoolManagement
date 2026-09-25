import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';

/**
 * The invoice these tests pay against: two charges of 150,000 and 106,000, so
 * a full payment is 256,000. `details` is what the fee-item loader hands back,
 * swapped per test to model a brought-forward balance or a slow request.
 */
const invoice = {
  id: 'inv-1',
  invoiceNo: 'INV/2026-2027/00018',
  termName: 'First Term',
  dueDate: '2026-10-25',
  balance: 256000,
};
const lines = [
  { id: 'line-a', description: 'Tuition', balance: 150000 },
  { id: 'line-b', description: 'Bus', balance: 106000 },
];

const fixtures = vi.hoisted(() => ({
  // Held as one object per test, not rebuilt on every call: a real query hands
  // back the same reference until the data changes, and the form's default
  // split re-runs whenever the invoice list's identity does.
  list: { items: [] as unknown[] },
  detail: null as unknown,
  detailPending: false,
}));

vi.mock('./api', () => ({
  useInvoices: () => ({ data: fixtures.list }),
  useInvoice: () => ({ isPending: fixtures.detailPending, data: fixtures.detail }),
  useInvoiceDetails: (ids: string[]) =>
    ids.map(() => ({
      data: fixtures.detailPending ? undefined : fixtures.detail,
      isError: false,
    })),
  useRecordPayment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

vi.mock('@/features/students/api', () => ({
  useStudent: () => ({ data: { id: 'stu-1', fullName: 'Ada Okafor', admissionNo: 'ADM-001' } }),
  useStudentLedger: () => ({ data: { summary: { balance: 256000 } } }),
  useStudentSearch: () => ({ data: undefined, isSearching: false }),
}));

import { PaymentFormPage } from './payment-form-page';

function seedInvoice(next: typeof invoice) {
  fixtures.list = { items: [next] };
  fixtures.detail = { ...next, lines };
}

function renderForm() {
  return renderPage(<PaymentFormPage />, { route: '/finance/payments/new?studentId=stu-1' });
}

const recordButton = () => screen.getByRole('button', { name: 'Record payment' });

describe('PaymentFormPage fee-item tally', () => {
  beforeEach(() => {
    seedInvoice(invoice);
    fixtures.detailPending = false;
  });
  afterEach(cleanup);

  it('blocks a part-payment whose fee items do not add up, without opening them', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/^Amount/), '100000');

    // 100,000 applied, but the invoice's charges still stand at 256,000.
    expect(recordButton()).toBeDisabled();
    expect(
      screen.getByText(/Fee items don't add up to what's applied/),
    ).toBeInTheDocument();
  });

  it('lets a payment through once the fee items add up to what is applied', async () => {
    const { container } = renderForm();
    await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
    expect(recordButton()).toBeDisabled();

    await userEvent.click(screen.getByText('Name which fee item this pays for'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const editAmount = () => screen.getAllByRole('button', { name: 'Edit amount' });
    await userEvent.click(editAmount()[0]!);
    await userEvent.type(
      container.querySelector('[data-cy="finance-payment-form-line-line-a"]')!,
      '100000',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    // Bus is still standing at its full 106,000.
    expect(recordButton()).toBeDisabled();

    await userEvent.click(editAmount()[1]!);
    await userEvent.type(
      container.querySelector('[data-cy="finance-payment-form-line-line-b"]')!,
      '0',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(recordButton()).toBeEnabled();
  });

  it('keeps a running total of the fee items while an amount is being typed', async () => {
    const { container } = renderForm();
    await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
    await userEvent.click(screen.getByText('Name which fee item this pays for'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const total = () => container.querySelector('[data-cy="finance-payment-form-lines-total-inv-1"]')!;
    // Nothing named yet: each charge stands at its full balance.
    expect(total()).toHaveTextContent('256,000');

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit amount' })[0]!);
    const box = container.querySelector('[data-cy="finance-payment-form-line-line-a"]')!;
    await userEvent.type(box, '1');
    expect(total()).toHaveTextContent('106,001');
    await userEvent.type(box, '00000');
    // Still typing — the box has not been confirmed — and the total has followed.
    expect(total()).toHaveTextContent('206,000');
  });

  it('lists the fee items a follow-up invoice carried in, and where they came from', async () => {
    // A follow-up with nothing of its own: the whole balance is carried lines.
    const carriedLines = [
      { id: 'c1', description: 'Tuition', balance: 40000, carriedFromInvoiceNo: 'INV/2026-2027/00020' },
      { id: 'c2', description: 'Exam', balance: 50000, carriedFromInvoiceNo: 'INV/2026-2027/00020' },
    ];
    const followUp = { ...invoice, balance: 90000 };
    seedInvoice(followUp);
    fixtures.detail = { ...followUp, lines: carriedLines };
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Amount/), '90000');

    await userEvent.click(screen.getByText('Name which fee item this pays for'));

    expect(screen.getByText('Tuition')).toBeInTheDocument();
    expect(screen.getByText('Exam')).toBeInTheDocument();
    expect(screen.getAllByText(/brought forward from INV\/2026-2027\/00020/)).toHaveLength(2);
  });

  it('lets a payment that clears the whole invoice through without opening the fee items', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/^Amount/), '256000');

    expect(recordButton()).toBeEnabled();
  });

  it('does not ask for more than the charges can absorb when a balance is brought forward', async () => {
    // Charges total 256,000; the other 44,000 is carried in from last term and
    // belongs to no charge, so no amount typed against a charge could cover it.
    seedInvoice({ ...invoice, balance: 300000 });
    renderForm();

    await userEvent.type(screen.getByLabelText(/^Amount/), '300000');

    expect(recordButton()).toBeEnabled();
  });

  it('holds the payment back until the fee items have loaded to check against', async () => {
    fixtures.detailPending = true;
    renderForm();

    await userEvent.type(screen.getByLabelText(/^Amount/), '256000');

    expect(recordButton()).toBeDisabled();
  });
});
