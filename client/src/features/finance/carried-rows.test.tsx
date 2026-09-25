import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CarriedInvoice, Invoice } from '@/types/finance';
import { carriedRows } from './carried-rows';
import { InvoicePos } from './invoice-pos';

// The follow-up from the bursar's own screen: ₦256,000 billed, ₦150,000 paid,
// ₦106,000 carried. ₦85,000 of what was paid named a fee item; the other
// ₦65,000 was paid against the invoice as a whole, so the items still add up
// to ₦171,000 and the difference has to be shown, or the list overstates it.
const carried: CarriedInvoice = {
  invoiceId: 'inv-18',
  invoiceNo: 'INV/2026-2027/00018',
  amount: 106_000,
  items: [
    { description: 'Tuition', amount: 55_000, paid: 30_000, balance: 25_000 },
    { description: 'Exam', amount: 40_000, paid: 0, balance: 40_000 },
    { description: 'Development', amount: 25_000, paid: 0, balance: 25_000 },
    { description: 'Boarding', amount: 36_000, paid: 15_000, balance: 21_000 },
    { description: 'Test', amount: 100_000, paid: 40_000, balance: 60_000 },
  ],
  unassigned: -65_000,
};

describe('carriedRows', () => {
  it('lists each fee item, then the payments that were never tied to one', () => {
    const rows = carriedRows(carried);

    expect(rows.map((row) => [row.label, row.balance])).toEqual([
      ['Tuition', 25_000],
      ['Exam', 40_000],
      ['Development', 25_000],
      ['Boarding', 21_000],
      ['Test', 60_000],
      ['Payments not tied to a fee item', -65_000],
    ]);
    expect(rows.at(-1)).toMatchObject({ billed: null, paid: 65_000 });
  });

  it('adds up to exactly what was carried', () => {
    const total = carriedRows(carried).reduce((sum, row) => sum + row.balance, 0);

    expect(total).toBe(carried.amount);
  });

  it('adds no squaring row when the items already come to what was carried', () => {
    const rows = carriedRows({
      ...carried,
      amount: 171_000,
      unassigned: 0,
    });

    expect(rows).toHaveLength(5);
  });

  it('shows a balance the closed invoice was itself carrying as a positive row', () => {
    const rows = carriedRows({ ...carried, amount: 201_000, unassigned: 30_000 });

    expect(rows.at(-1)).toMatchObject({
      label: 'Earlier balance brought forward',
      paid: null,
      balance: 30_000,
    });
  });

  it('is empty for an invoice with nothing left on any item and nothing to square', () => {
    expect(carriedRows({ ...carried, items: [], amount: 0, unassigned: 0 })).toEqual([]);
  });
});

describe('InvoicePos with a balance brought forward', () => {
  afterEach(cleanup);

  const record = {
    id: 'inv-19',
    invoiceNo: 'INV/2026-2027/00019',
    schoolName: 'Tender Steps',
    schoolAddress: 'Lagos',
    studentName: 'Chukwuemeka Umeh',
    admissionNo: 'TSC/2026/0005',
    className: 'Nursery 1',
    termName: 'First Term',
    sessionName: '2026/2027',
    issueDate: '2026-09-25',
    dueDate: '2026-10-25',
    lines: [],
    carriedFrom: [carried],
    subtotal: 0,
    discountTotal: 0,
    appliedDiscounts: [],
    broughtForward: 106_000,
    total: 106_000,
    amountPaid: 0,
    balance: 106_000,
  } as unknown as Invoice;

  it('prints the fee items it is still for, not just one lump', () => {
    render(<InvoicePos record={record} accountSummary={[]} />);

    expect(screen.getByText('Brought forward from INV/2026-2027/00018')).toBeInTheDocument();
    for (const item of ['Tuition', 'Exam', 'Development', 'Boarding', 'Test']) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    expect(screen.getByText('Payments not tied to a fee item')).toBeInTheDocument();
    // The lump total is still there for the sum at the foot.
    expect(screen.getByText('Brought forward')).toBeInTheDocument();
  });

  it('prints nothing extra for an invoice that carries nothing', () => {
    render(<InvoicePos record={{ ...record, carriedFrom: [], broughtForward: 0 }} accountSummary={[]} />);

    expect(screen.queryByText(/Brought forward from/)).not.toBeInTheDocument();
  });
});
