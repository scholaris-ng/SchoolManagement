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

  it('will not let a charge that money was put towards be removed', async () => {
    renderEdit();
    await screen.findByText('Brought forward from INV/2026-2027/00018');

    const [tuition, boarding, bus] = screen.getAllByRole('button', { name: 'Remove line' });
    expect(tuition).toBeDisabled();
    expect(boarding).toBeDisabled();
    expect(bus).toBeEnabled();
    expect(screen.getAllByText(/has been paid towards this charge/)).toHaveLength(2);
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
          expect.objectContaining({ feeItemId: 'tuition', keepSavedPrice: true }),
          expect.objectContaining({ feeItemId: 'boarding', keepSavedPrice: true }),
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

    expect(screen.getByText(/needs at least one charge/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
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
