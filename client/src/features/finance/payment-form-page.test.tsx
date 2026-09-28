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
  // One stable mock across renders, so calls made to it accumulate instead of
  // being lost the moment a fresh `useRecordPayment()` call would otherwise
  // hand back a brand new `vi.fn()`.
  recordPayment: { mutateAsync: vi.fn(), isPending: false, error: null as unknown },
}));

vi.mock('./api', () => ({
  useInvoices: () => ({ data: fixtures.list }),
  useInvoice: () => ({ isPending: fixtures.detailPending, data: fixtures.detail }),
  useInvoiceDetails: (ids: string[]) =>
    ids.map(() => ({
      data: fixtures.detailPending ? undefined : fixtures.detail,
      isError: false,
    })),
  useRecordPayment: () => fixtures.recordPayment,
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
    fixtures.recordPayment.mutateAsync.mockReset().mockResolvedValue({ id: 'pay-1' });
    fixtures.recordPayment.error = null;
  });
  afterEach(cleanup);

  describe('the default: split automatically, no click needed', () => {
    it("splits a part-payment across the invoice's fee items, panel open on its own", async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');

      // No click needed — the panel is open by default the moment money is
      // applied, showing the split that already happened underneath.
      expect(await screen.findByText('Tuition')).toBeInTheDocument();
      expect(recordButton()).toBeEnabled();

      // Tuition (150,000 balance) takes the first 100,000; nothing is left
      // for Bus — named "0", not left blank, so it reads as settled, not unset.
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
        '100,000',
      );
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
        '₦0',
      );
      // Still the default — nobody has asked to name amounts by hand.
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit amount' })).not.toBeInTheDocument();
    });

    it('spreads a larger amount across more than one fee item, in order, with no click needed', async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '200000');
      await screen.findByText('Tuition');

      expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
        '150,000',
      );
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
        '50,000',
      );
      expect(recordButton()).toBeEnabled();
    });

    it("opens every applied invoice's panel at once, independently of the others", async () => {
      const second = {
        id: 'inv-2',
        invoiceNo: 'INV/2026-2027/00019',
        termName: 'Second Term',
        dueDate: '2026-11-25',
        balance: 50000,
      };
      seedInvoice(invoice);
      fixtures.list = { items: [invoice, second] };
      renderForm();

      // 256,000 clears the first invoice (the older due date) in full; the
      // remaining 50,000 of the 306,000 paid is what's left for the second.
      await userEvent.type(screen.getByLabelText(/^Amount/), '306000');

      await screen.findAllByText('Tuition');
      expect(screen.getAllByText('Tuition')).toHaveLength(2);
      expect(recordButton()).toBeEnabled();

      // Collapsing one leaves the other exactly as it was.
      await userEvent.click(screen.getAllByText('Name which fee item this pays for')[0]!);
      expect(screen.getAllByText('Tuition')).toHaveLength(1);
    });

    it('previews an invoice with nothing applied to it yet, on request, closed by default', async () => {
      renderForm();

      // Nothing typed into "Amount" — there is no split yet to show by default.
      expect(screen.queryByText('Tuition')).not.toBeInTheDocument();

      await userEvent.click(screen.getByText('Name which fee item this pays for'));
      expect(await screen.findByText('Tuition')).toBeInTheDocument();
      // Full balances, not a split — there is nothing applied to split yet.
      expect(screen.getByText('Bus').closest('li')).toHaveTextContent('106,000');

      await userEvent.click(screen.getByText('Name which fee item this pays for'));
      expect(screen.queryByText('Tuition')).not.toBeInTheDocument();
    });

    it('can still be collapsed, and stays collapsed, for whoever would rather not see it', async () => {
      renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
      await screen.findByText('Tuition');

      await userEvent.click(screen.getByText('Name which fee item this pays for'));
      expect(screen.queryByText('Tuition')).not.toBeInTheDocument();

      // Still collapsed after the amount changes — closing it is a choice.
      await userEvent.type(screen.getByLabelText(/^Amount/), '1');
      expect(screen.queryByText('Tuition')).not.toBeInTheDocument();
      expect(recordButton()).toBeEnabled();
    });

    it('sends the automatic split with the payment, whether or not the panel was ever opened', async () => {
      renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');

      await userEvent.click(recordButton());

      expect(fixtures.recordPayment.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allocations: [
            expect.objectContaining({
              invoiceId: 'inv-1',
              amount: 100000,
              // Bus's explicit "0" is left out — no fee item is named for
              // nothing, same rule a manual breakdown already followed.
              lines: [{ lineId: 'line-a', amount: 100000 }],
            }),
          ],
        }),
      );
    });

    it('stays enabled at every step while an amount is typed digit by digit', async () => {
      const { container } = renderForm();
      const amountInput = screen.getByLabelText(/^Amount/);
      await userEvent.click(screen.getByText('Name which fee item this pays for'));
      const total = () => container.querySelector('[data-cy="finance-payment-form-lines-total-inv-1"]')!;

      // Each keystroke re-splits the running amount — never a moment where
      // the fee items disagree with what has been applied so far.
      await userEvent.type(amountInput, '1');
      expect(total()).toHaveTextContent('1');
      expect(recordButton()).toBeEnabled();
      await userEvent.type(amountInput, '00000');
      expect(total()).toHaveTextContent('100,000');
      expect(recordButton()).toBeEnabled();
    });
  });

  describe('opting out: naming amounts by hand', () => {
    it("starts from what the automatic split already showed, once 'Edit' is clicked", async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
      await screen.findByText('Tuition');

      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

      // Unchanged by switching modes — a starting point to adjust, not a blank slate.
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
        '100,000',
      );
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
        '₦0',
      );
      expect(screen.getByRole('button', { name: 'Use the automatic split' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Edit amount' })).toHaveLength(2);
    });

    it('blocks the payment once a hand-typed amount leaves the fee items mismatched', async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
      await screen.findByText('Tuition');
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

      // Pulls Tuition down from its seeded 100,000, leaving 50,000 of the
      // 100,000 applied unaccounted for.
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit amount' })[0]!);
      const box = container.querySelector('[data-cy="finance-payment-form-line-line-a"]')!;
      await userEvent.clear(box);
      await userEvent.type(box, '50000');
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(recordButton()).toBeDisabled();
      expect(screen.getByText(/Fee items don't add up to what's applied/)).toBeInTheDocument();

      // Closing it while still mismatched is a choice — not fought back open.
      await userEvent.click(screen.getByText('Name which fee item this pays for'));
      expect(screen.queryByText('Tuition')).not.toBeInTheDocument();
      expect(recordButton()).toBeDisabled();
    });

    it("the rescue button fixes a hand-typed mismatch without leaving manual mode", async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
      await screen.findByText('Tuition');
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit amount' })[0]!);
      const box = container.querySelector('[data-cy="finance-payment-form-line-line-a"]')!;
      await userEvent.clear(box);
      await userEvent.type(box, '50000');
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(recordButton()).toBeDisabled();

      await userEvent.click(
        screen.getByRole('button', { name: /Split .* across these fee items automatically/ }),
      );

      expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
        '100,000',
      );
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
        '₦0',
      );
      expect(recordButton()).toBeEnabled();
      // Still a manual breakdown — this only recomputed it, it did not exit.
      expect(screen.getByRole('button', { name: 'Use the automatic split' })).toBeInTheDocument();
    });

    it("'Use the automatic split' discards the hand-typed amounts and returns to the default", async () => {
      const { container } = renderForm();
      await userEvent.type(screen.getByLabelText(/^Amount/), '100000');
      await screen.findByText('Tuition');
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit amount' })[0]!);
      const box = container.querySelector('[data-cy="finance-payment-form-line-line-a"]')!;
      await userEvent.clear(box);
      await userEvent.type(box, '50000');
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(recordButton()).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Use the automatic split' }));

      expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
        '100,000',
      );
      expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
        '₦0',
      );
      expect(recordButton()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit amount' })).not.toBeInTheDocument();
    });
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

    expect(await screen.findByText('Tuition')).toBeInTheDocument();
    expect(screen.getByText('Exam')).toBeInTheDocument();
    expect(screen.getAllByText(/brought forward from INV\/2026-2027\/00020/)).toHaveLength(2);
  });

  it('lets a payment that clears the whole invoice through, split across every fee item in full', async () => {
    const { container } = renderForm();

    await userEvent.type(screen.getByLabelText(/^Amount/), '256000');

    expect(recordButton()).toBeEnabled();
    expect(await screen.findByText('Tuition')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="finance-payment-form-line-line-a"]')).toHaveTextContent(
      '150,000',
    );
    expect(container.querySelector('[data-cy="finance-payment-form-line-line-b"]')).toHaveTextContent(
      '106,000',
    );
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
