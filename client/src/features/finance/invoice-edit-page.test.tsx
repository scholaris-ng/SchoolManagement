import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';

const item = (id: string, name: string, amount: number) => ({
  id,
  name,
  amount,
  isOptional: false,
  hasQuantity: false,
  accounts: [] as unknown[],
  priceOptions: [] as unknown[],
});

const line = (
  id: string,
  feeItemId: string,
  description: string,
  lineTotal: number,
  amountPaid: number,
) => ({
  id,
  feeItemId,
  description,
  quantity: 1,
  unitAmount: lineTotal,
  discountAmount: 0,
  lineTotal,
  isOptional: false,
  accounts: [],
  carriedFromInvoiceId: null,
  carriedFromInvoiceNo: null,
  amountPaid,
  balance: lineTotal - amountPaid,
});

// Held constant across renders, the way a real query's result is: the page
// re-runs effects whenever these references change.
const stable = vi.hoisted(() => ({
  feeItems: { data: { items: [] as unknown[] } },
  discounts: { data: [] as unknown[] },
  studentDiscounts: { data: [] as unknown[] },
  resolve: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false, error: null },
  invoice: { data: undefined as unknown, isPending: false, isError: false, error: null },
  details: {} as Record<string, { data: unknown; isPending: boolean; isError: boolean }>,
}));

vi.mock('./api', () => ({
  useDiscounts: () => stable.discounts,
  useFeeItems: () => stable.feeItems,
  useInvoice: () => stable.invoice,
  useInvoiceDetails: (ids: string[]) =>
    ids.map((id) => stable.details[id] ?? { data: undefined, isPending: true, isError: false }),
  useResolveFeeStructure: () => stable.resolve,
  useStudentDiscounts: () => stable.studentDiscounts,
  useUpdateInvoice: () => stable.update,
}));

// Not what is under test, and it reads the signed-in user's permissions.
vi.mock('./invoice-discounts-picker', () => ({ InvoiceDiscountsPicker: () => null }));

import { InvoiceEditPage } from './invoice-edit-page';

const renderEdit = () =>
  renderPage(<InvoiceEditPage />, {
    route: '/finance/invoices/inv-19/edit',
    path: '/finance/invoices/:id/edit',
  });

/**
 * INV/00019, which brought forward ₦106,000 from INV/00018 and bills nothing of
 * its own — the shape of invoice whose items could not be edited at all before.
 */
const followUp = {
  id: 'inv-19',
  invoiceNo: 'INV/2026-2027/00019',
  studentId: 'stu-1',
  studentName: 'Chukwuemeka Umeh',
  admissionNo: 'TSC/2026/0005',
  className: 'Nursery 1',
  sessionId: 's-1',
  sessionName: '2026/2027',
  termId: 't-1',
  termName: 'First Term',
  dueDate: '2026-10-25',
  note: null,
  status: 'ISSUED',
  subtotal: 0,
  discountTotal: 0,
  appliedDiscounts: [],
  broughtForward: 106000,
  total: 106000,
  amountPaid: 0,
  balance: 106000,
  lines: [],
  carriedFrom: [
    { invoiceId: 'inv-18', invoiceNo: 'INV/2026-2027/00018', amount: 106000, items: [], unassigned: 0 },
  ],
};

const original = {
  id: 'inv-18',
  invoiceNo: 'INV/2026-2027/00018',
  studentId: 'stu-1',
  lines: [
    line('l-tuition', 'tuition', 'Tuition', 55000, 30000),
    line('l-boarding', 'boarding', 'Boarding', 36000, 15000),
    line('l-bus', 'bus', 'Bus', 20000, 0),
  ],
  appliedDiscounts: [],
  carriedFrom: [],
};

describe('InvoiceEditPage brought-forward items', () => {
  beforeEach(() => {
    stable.feeItems = {
      data: {
        items: [
          item('tuition', 'Tuition', 55000),
          item('boarding', 'Boarding', 36000),
          item('bus', 'Bus', 20000),
          item('books', 'Textbooks', 50000),
        ],
      },
    };
    stable.invoice = { data: followUp, isPending: false, isError: false, error: null };
    stable.details = { 'inv-18': { data: original, isPending: false, isError: false } };
    stable.update.mutateAsync = vi.fn().mockResolvedValue({ id: 'inv-19' });
  });
  afterEach(cleanup);

  it('lists the items brought forward, under the invoice they came from, as editable rows', async () => {
    renderEdit();

    expect(
      await screen.findByText('Brought forward from INV/2026-2027/00018'),
    ).toBeInTheDocument();
    // This invoice bills nothing of its own; the three rows are the earlier invoice's.
    expect(screen.getAllByRole('button', { name: 'Remove line' })).toHaveLength(3);
    // One "Add a line" for this invoice's own charges, one for the brought-forward group.
    const adds = screen.getAllByRole('button', { name: /Add a line/ });
    expect(adds).toHaveLength(2);
    adds.forEach((button) => expect(button).toBeEnabled());
  });

  it('shows what is paid and what is left on each item, beside its amount', async () => {
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    const column = (cy: string) =>
      Array.from(document.querySelectorAll(`[data-cy="${cy}"]`)).map((cell) => cell.textContent ?? '');

    const paid = column('finance-invoice-edit-paid');
    expect(paid).toHaveLength(3);
    expect(paid[0]).toContain('30,000'); // Tuition
    expect(paid[1]).toContain('15,000'); // Boarding
    expect(paid[2]).toContain('—'); // Bus — nothing paid yet

    const balance = column('finance-invoice-edit-balance');
    expect(balance[0]).toContain('25,000');
    expect(balance[1]).toContain('21,000');
    expect(balance[2]).toContain('20,000');
  });

  it('updates the balance as an amount is changed, with the paid figure staying put', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Take 5,000 off Tuition (55,000 billed, 30,000 paid).
    const discountInputs = screen.getAllByPlaceholderText('0');
    await user.type(discountInputs[0], '5000');

    const paid = document.querySelectorAll('[data-cy="finance-invoice-edit-paid"]')[0];
    const balance = document.querySelectorAll('[data-cy="finance-invoice-edit-balance"]')[0];
    expect(paid.textContent).toContain('30,000');
    expect(balance.textContent).toContain('20,000');
  });

  it('says why "Save changes" is greyed out, and stops saying it once the reason is given', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Nothing changed yet: Save is available and there is nothing to explain.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(screen.queryByText(/to save\./)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[2]);

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    const hint = await screen.findByRole('button', { name: /Say why the charges are changing to save/ });

    // The hint takes the person to the box that is missing.
    await user.click(hint);
    expect(screen.getByLabelText(/Why are the charges changing/)).toHaveFocus();

    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Bus was a mistake');
    expect(save).toBeEnabled();
    expect(screen.queryByText(/Say why the charges are changing to save/)).not.toBeInTheDocument();
  });

  it('says so when the due date has been cleared', async () => {
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByText('Set a due date to save.')).toBeInTheDocument();
  });

  it('lets a charge that money was put towards be removed, and says where the money stays', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Nothing is locked: the paid charges are removable like any other.
    const removes = screen.getAllByRole('button', { name: 'Remove line' });
    expect(removes).toHaveLength(3);
    removes.forEach((button) => expect(button).toBeEnabled());
    // Each paid row says what happens to the money instead of refusing.
    expect(screen.getAllByText(/stays on the invoice/)).toHaveLength(2);

    // And the fee item on a paid row can be swapped for another.
    const [tuitionSelect] = screen.getAllByRole('combobox', { name: 'Fee item' });
    expect(tuitionSelect).toBeEnabled();

    await user.click(removes[0]);
    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Tuition was billed twice');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(stable.update.mutateAsync).toHaveBeenCalledTimes(1));
    const { input } = stable.update.mutateAsync.mock.calls[0][0];

    // Tuition (₦30,000 paid) is simply not in what is sent: the server takes it off.
    expect(input.carried[0].lines.map((entry: { feeItemId: string }) => entry.feeItemId)).toEqual([
      'boarding',
      'bus',
    ]);
  });

  it('warns that a total below what was paid becomes a credit, instead of refusing it', async () => {
    stable.invoice = {
      data: { ...followUp, amountPaid: 100000, balance: 6000 },
      isPending: false,
      isError: false,
      error: null,
    };
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Take Tuition (55,000) and Bus (20,000) off: 106,000 → 31,000, under the 100,000 paid.
    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[1]);

    const warning = await screen.findByText(/less than the/);
    expect(warning).toHaveTextContent(/credit on the student's account/);
    expect(screen.queryByText(/will be refused/)).not.toBeInTheDocument();
  });

  it('asks why before a removed item can be saved, then edits the earlier invoice from here', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeEnabled();
    expect(screen.queryByLabelText(/Why are the charges changing/)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[2]);

    // A reason is owed now, and saving waits for it.
    expect(await screen.findByLabelText(/Why are the charges changing/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Bus was added by mistake');
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(stable.update.mutateAsync).toHaveBeenCalledTimes(1));
    const { id, input } = stable.update.mutateAsync.mock.calls[0][0];

    expect(id).toBe('inv-19');
    expect(input.reason).toBe('Bus was added by mistake');
    // This invoice's own charges were not touched, so none are sent — and so
    // none are re-priced.
    expect(input.lines).toBeUndefined();
    expect(input.carried).toEqual([
      {
        invoiceId: 'inv-18',
        lines: [
          // Untouched charges are told to keep both their price and whatever
          // discount they already had — a hand-keyed one cannot be recovered
          // afterwards, and dropping it silently raised the charge.
          expect.objectContaining({
            feeItemId: 'tuition',
            keepSavedPrice: true,
            keepSavedDiscount: true,
          }),
          expect.objectContaining({
            feeItemId: 'boarding',
            keepSavedPrice: true,
            keepSavedDiscount: true,
          }),
        ],
      },
    ]);
  });

  it('keeps an untouched item at the price it was billed at when the fee list has moved', async () => {
    // Tuition is ₦70,000 on today's fee list but was billed at ₦55,000.
    stable.feeItems = {
      data: {
        items: [
          item('tuition', 'Tuition', 70000),
          item('boarding', 'Boarding', 36000),
          item('bus', 'Bus', 20000),
        ],
      },
    };
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[2]);
    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Bus was a mistake');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(stable.update.mutateAsync).toHaveBeenCalled());
    const tuition = stable.update.mutateAsync.mock.calls[0][0].input.carried[0].lines[0];
    // Told to keep the saved price, not re-price from the ₦70,000 on the list.
    expect(tuition).toMatchObject({ feeItemId: 'tuition', keepSavedPrice: true });
  });

  it('sends no charges at all for a due-date-only edit', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(stable.update.mutateAsync).toHaveBeenCalledTimes(1));
    const { input } = stable.update.mutateAsync.mock.calls[0][0];

    expect(input.dueDate).toBe('2026-12-01');
    expect(input.lines).toBeUndefined();
    expect(input.carried).toBeUndefined();
    expect(input.reason).toBeUndefined();
  });

  it('refuses to save once an earlier invoice is left with no charge', async () => {
    stable.details = {
      'inv-18': {
        data: { ...original, lines: [line('l-bus', 'bus', 'Bus', 20000, 0)] },
        isPending: false,
        isError: false,
      },
    };
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    await user.click(screen.getByRole('button', { name: 'Remove line' }));
    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Not needed');

    // Said next to the group that is empty, and again beside the greyed-out Save.
    expect(screen.getByText(/put one back to save/)).toBeInTheDocument();
    expect(screen.getByText(/Each earlier invoice needs at least one charge to save/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});

describe('InvoiceEditPage settled items on an earlier invoice', () => {
  // INV/00018 billed five charges, but two are paid in full and so are not on
  // the follow-up INV/00019, which lists only the three still owing.
  const withSettled = () => {
    stable.feeItems = {
      data: {
        items: [
          item('tuition', 'Tuition', 55000),
          item('exam', 'Exam', 40000),
          item('boarding', 'Boarding', 36000),
          item('development', 'Development', 25000),
          item('bus', 'Bus', 20000),
          item('books', 'Textbooks', 50000),
        ],
      },
    };
    stable.invoice = {
      data: {
        ...followUp,
        carriedFrom: [
          {
            invoiceId: 'inv-18',
            invoiceNo: 'INV/2026-2027/00018',
            amount: 106000,
            unassigned: 0,
            items: [
              { description: 'Tuition', amount: 55000, paid: 30000, balance: 25000 },
              { description: 'Boarding', amount: 36000, paid: 15000, balance: 21000 },
              { description: 'Bus', amount: 20000, paid: 0, balance: 20000 },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    };
    stable.details = {
      'inv-18': {
        data: {
          ...original,
          lines: [
            line('l-tuition', 'tuition', 'Tuition', 55000, 30000),
            line('l-exam', 'exam', 'Exam', 40000, 40000),
            line('l-boarding', 'boarding', 'Boarding', 36000, 15000),
            line('l-dev', 'development', 'Development', 25000, 25000),
            line('l-bus', 'bus', 'Bus', 20000, 0),
          ],
        },
        isPending: false,
        isError: false,
      },
    };
    stable.update.mutateAsync = vi.fn().mockResolvedValue({ id: 'inv-19' });
  };

  beforeEach(withSettled);
  afterEach(cleanup);

  it('shows only the items the invoice lists, and says the others are left alone', async () => {
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Three owing items — not the five the earlier invoice actually has.
    expect(screen.getAllByRole('button', { name: 'Remove line' })).toHaveLength(3);
    expect(screen.queryByDisplayValue('Exam')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Development')).not.toBeInTheDocument();
    expect(screen.getByText(/2 fully paid items on/)).toBeInTheDocument();
  });

  it('keeps the hidden items on the earlier invoice when the others are edited', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // Remove Bus — the third of the three that are shown.
    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[2]);
    await user.type(screen.getByLabelText(/Why are the charges changing/), 'Bus was a mistake');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(stable.update.mutateAsync).toHaveBeenCalledTimes(1));
    const { input } = stable.update.mutateAsync.mock.calls[0][0];
    const sent = input.carried[0].lines.map((entry: { feeItemId: string }) => entry.feeItemId);

    // Exam and Development were never on screen, and are not deleted by the save.
    expect(sent).toEqual(['tuition', 'exam', 'boarding', 'development']);
  });

  it('brings the settled items into view on request', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getAllByRole('button', { name: 'Remove line' })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('will not offer a fee item the earlier invoice already has, hidden or not', async () => {
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    // On the Bus row, "Exam" is already on the invoice (out of sight) and cannot
    // be picked a second time; an item that is not on it can.
    const selects = screen.getAllByRole('combobox', { name: 'Fee item' });
    const busSelect = selects[2];
    const option = (name: string) =>
      Array.from(busSelect.querySelectorAll('option')).find((entry) => entry.textContent === name);

    expect(option('Exam')).toBeDisabled();
    expect(option('Textbooks')).toBeEnabled();
  });
});

describe('InvoiceEditPage carried-forward invoice', () => {
  afterEach(cleanup);

  it('can still be edited, and says the invoice that took it over will follow', async () => {
    stable.feeItems = { data: { items: [item('bus', 'Bus', 20000)] } };
    stable.details = {};
    stable.invoice = {
      data: {
        ...original,
        status: 'CANCELLED',
        carriedForwardToInvoiceId: 'inv-19',
        carriedForwardToInvoiceNo: 'INV/2026-2027/00019',
        dueDate: '2026-10-05',
        note: null,
        subtotal: 20000,
        discountTotal: 0,
        broughtForward: 0,
        total: 20000,
        amountPaid: 0,
        sessionId: 's-1',
        termId: 't-1',
        studentName: 'Chukwuemeka Umeh',
        admissionNo: 'TSC/2026/0005',
        termName: 'First Term',
        sessionName: '2026/2027',
        lines: [line('l-bus', 'bus', 'Bus', 20000, 0)],
        carriedFrom: [],
      },
      isPending: false,
      isError: false,
      error: null,
    };
    renderEdit();

    expect(await screen.findByText(/balance was carried forward to/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'INV/2026-2027/00019' })).toBeInTheDocument();
    expect(screen.queryByText(/can no longer be edited/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
