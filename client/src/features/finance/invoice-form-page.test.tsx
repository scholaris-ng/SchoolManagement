import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';

type Detail = { data: unknown; isPending: boolean; isError: boolean };

// Everything a query hook hands back is held constant across renders, the way
// a real query does: the form re-runs effects whenever these references change.
const stable = vi.hoisted(() => ({
  currentTerm: { data: { id: 'term-1' } },
  terms: { data: [{ id: 'term-1', name: 'First Term', sessionName: '2026/2027' }] },
  feeItems: { data: { items: [] as unknown[] } },
  discounts: { data: [] as unknown[] },
  studentDiscounts: { data: [] as unknown[] },
  student: { data: { id: 'stu-1', fullName: 'Ada Okafor', admissionNo: 'ADM-001' } },
  search: { data: undefined, isSearching: false },
  create: { mutateAsync: vi.fn(), isPending: false, error: null },
  resolve: { mutateAsync: vi.fn(), isPending: false },
  /** What the student already has billed in the selected term. */
  termInvoices: {
    isLoading: false,
    isPlaceholderData: false,
    data: { items: [] as unknown[] },
  },
  /** Each of those invoices' fee items, by invoice id, as the detail read returns them. */
  details: {} as Record<string, Detail>,
}));

vi.mock('./api', () => ({
  useCreateInvoice: () => stable.create,
  useDiscounts: () => stable.discounts,
  useFeeItems: () => stable.feeItems,
  useInvoices: () => stable.termInvoices,
  useInvoiceDetails: (ids: string[]) =>
    ids.map((id) => stable.details[id] ?? { data: undefined, isPending: true, isError: false }),
  useResolveFeeStructure: () => stable.resolve,
  useStudentDiscounts: () => stable.studentDiscounts,
}));
vi.mock('@/features/academics/api', () => ({
  useCurrentTerm: () => stable.currentTerm,
  useTerms: () => stable.terms,
}));
vi.mock('@/features/students/api', () => ({
  useStudent: () => stable.student,
  useStudentSearch: () => stable.search,
}));

// Not what is under test, and it reads the signed-in user's permissions.
vi.mock('./invoice-discounts-picker', () => ({ InvoiceDiscountsPicker: () => null }));

import { InvoiceFormPage } from './invoice-form-page';

const renderForm = () =>
  renderPage(<InvoiceFormPage />, { route: '/finance/invoices/new?studentId=stu-1' });

/** A live invoice this term, with `left` still to pay of what it billed. */
const invoiceWith = (left: number, over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNo: 'INV/2026-2027/00018',
  status: left > 0 ? 'PART_PAID' : 'PAID',
  balance: left,
  ...over,
});

const withLines = (lines: { id: string; description: string; lineTotal: number; balance: number }[]) => {
  stable.details['inv-1'] = { isPending: false, isError: false, data: { lines } };
};

const standardFeesButton = () => screen.queryByRole('button', { name: 'Add all standard fees' });

describe('InvoiceFormPage standard fees', () => {
  beforeEach(() => {
    stable.termInvoices.isLoading = false;
    stable.termInvoices.isPlaceholderData = false;
    stable.termInvoices.data = { items: [] };
    stable.details = {};
  });
  afterEach(cleanup);

  it('offers the standard fees for a student with nothing billed this term yet', () => {
    renderForm();

    expect(standardFeesButton()).toBeEnabled();
    expect(screen.queryByText('Already billed this term')).not.toBeInTheDocument();
  });

  it('drops the standard fees once the student already has an invoice this term', () => {
    stable.termInvoices.data = { items: [invoiceWith(106000)] };
    renderForm();

    expect(standardFeesButton()).not.toBeInTheDocument();
    expect(screen.getByText(/already has an invoice for this term/)).toBeInTheDocument();
    // Picking items one at a time is still the way to bill a follow-up.
    expect(screen.getByRole('button', { name: 'Add a line' })).toBeInTheDocument();
  });

  it('still offers them when the only invoice this term was cancelled', () => {
    stable.termInvoices.data = { items: [invoiceWith(106000, { status: 'CANCELLED' })] };
    renderForm();

    expect(standardFeesButton()).toBeEnabled();
    expect(screen.queryByText('Already billed this term')).not.toBeInTheDocument();
  });

  it('holds the button back while it is still finding out what is already billed', () => {
    stable.termInvoices.isLoading = true;
    renderForm();

    expect(standardFeesButton()).toBeDisabled();
  });

  it("shows what is still left on each fee item of this term's earlier invoice", () => {
    stable.termInvoices.data = { items: [invoiceWith(106000)] };
    withLines([
      { id: 'l1', description: 'Tuition', lineTotal: 150000, balance: 0 },
      { id: 'l2', description: 'Bus', lineTotal: 106000, balance: 106000 },
    ]);
    renderForm();

    expect(screen.getByText('Already billed this term')).toBeInTheDocument();
    expect(screen.getByText('INV/2026-2027/00018')).toBeInTheDocument();
    expect(screen.getByText(/106,000 left to pay/)).toBeInTheDocument();
    expect(screen.getByText('Tuition').closest('li')).toHaveTextContent('Paid');
    expect(screen.getByText('Bus').closest('li')).toHaveTextContent(/106,000 left/);
  });

  it('reads an invoice that is settled in full as paid, whatever its items say', () => {
    stable.termInvoices.data = { items: [invoiceWith(0)] };
    // Paid by a lump sum, so no payment ever named this item.
    withLines([{ id: 'l1', description: 'Tuition', lineTotal: 150000, balance: 150000 }]);
    renderForm();

    expect(screen.getByText('Paid in full')).toBeInTheDocument();
    expect(screen.getByText('Tuition').closest('li')).toHaveTextContent('Paid');
    expect(screen.getByText('Tuition').closest('li')).not.toHaveTextContent('left');
  });

  it('says so when some payments were not tied to a fee item', () => {
    // 150,000 billed on one item, 50,000 paid as a lump sum: the item still
    // reads 150,000 owing, but only 100,000 is actually left on the invoice.
    stable.termInvoices.data = { items: [invoiceWith(100000)] };
    withLines([{ id: 'l1', description: 'Tuition', lineTotal: 150000, balance: 150000 }]);
    renderForm();

    expect(screen.getByText(/not tied to a fee item/)).toBeInTheDocument();
  });
});

describe('InvoiceFormPage follow-up invoice', () => {
  const feeItem = {
    id: 'fee-1',
    name: 'Uniform',
    amount: 5000,
    isOptional: false,
    hasQuantity: false,
    accounts: [],
    priceOptions: [],
  };
  const createButton = () => screen.getByRole('button', { name: 'Create invoice' });
  const carryBox = () => screen.getByRole('checkbox', { name: /Carry the .* still owing/ });

  beforeEach(() => {
    stable.termInvoices.isLoading = false;
    stable.termInvoices.isPlaceholderData = false;
    stable.termInvoices.data = { items: [invoiceWith(106000)] };
    stable.details = {};
    stable.feeItems.data = { items: [] };
    withLines([{ id: 'l1', description: 'Tuition', lineTotal: 150000, balance: 106000 }]);
    stable.create.mutateAsync.mockReset().mockResolvedValue({ id: 'new-1' });
  });
  afterEach(cleanup);

  it('can be created straight away, carrying what is left on the earlier invoice', async () => {
    renderForm();

    expect(carryBox()).toBeChecked();
    // No charges picked, yet there is something to bill: what is carried over.
    expect(createButton()).toBeEnabled();
    expect(screen.getByText('Total to pay').nextElementSibling).toHaveTextContent('106,000');

    await userEvent.click(createButton());

    expect(stable.create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'stu-1', lines: [], carryInvoiceIds: ['inv-1'] }),
    );
  });

  it('needs a charge again once the carry is switched off', async () => {
    renderForm();

    await userEvent.click(carryBox());

    expect(carryBox()).not.toBeChecked();
    expect(createButton()).toBeDisabled();
    expect(screen.queryByText('Total to pay')).not.toBeInTheDocument();
  });

  it('carries nothing when it has been switched off, even with a charge picked', async () => {
    stable.feeItems.data = { items: [feeItem] };
    renderForm();

    await userEvent.click(carryBox());
    await userEvent.click(screen.getByRole('button', { name: 'Add a line' }));
    expect(createButton()).toBeEnabled();
    await userEvent.click(createButton());

    expect(stable.create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ carryInvoiceIds: [] }),
    );
  });

  it('has nothing to carry, and offers no choice, when the earlier invoice is paid in full', () => {
    stable.termInvoices.data = { items: [invoiceWith(0)] };
    renderForm();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });
});
