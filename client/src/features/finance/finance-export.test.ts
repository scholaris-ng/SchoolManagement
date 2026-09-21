import { describe, expect, it } from 'vitest';
import type { Invoice, Payment } from '@/types/finance';
import { exportFileName, invoiceExportRows, paymentExportRows } from './finance-export';

describe('exportFileName', () => {
  const now = new Date('2026-09-21T10:00:00.000Z');

  it('names the period when both ends are set', () => {
    expect(exportFileName('payments', { dateFrom: '2026-09-01', dateTo: '2026-09-30' }, now)).toBe(
      'payments-2026-09-01_to_2026-09-30.xlsx',
    );
  });

  it('says which end is open when only one is set', () => {
    expect(exportFileName('invoices', { dateFrom: '2026-09-01' }, now)).toBe(
      'invoices-from-2026-09-01.xlsx',
    );
    expect(exportFileName('invoices', { dateTo: '2026-09-30' }, now)).toBe(
      'invoices-until-2026-09-30.xlsx',
    );
  });

  it('is the day of export when there is no period, as it was before', () => {
    expect(exportFileName('payments', {}, now)).toBe('payments-2026-09-21.xlsx');
    expect(exportFileName('payments', { method: 'CASH', search: 'ada' }, now)).toBe(
      'payments-2026-09-21.xlsx',
    );
  });

  it('ignores a date that is not text', () => {
    expect(exportFileName('payments', { dateFrom: 20260901 }, now)).toBe('payments-2026-09-21.xlsx');
  });
});

describe('paymentExportRows', () => {
  const payment: Payment = {
    id: 'pay-1',
    schoolId: 'school-1',
    reference: 'PAY-1',
    studentId: 'stu-1',
    studentName: 'Ada Okafor',
    admissionNo: 'ADM-001',
    amount: 50000,
    method: 'CASH',
    provider: 'MANUAL',
    status: 'SUCCESSFUL',
    // No offset, so it reads as local time wherever the test runs.
    paidAt: '2026-09-01T00:30:00',
    allocations: [],
    unallocatedAmount: 50000,
    isReconciled: false,
    receiptNo: null,
    recordedByName: 'Bursar',
  } as unknown as Payment;

  it('keeps the columns the export always had, in the same order', () => {
    expect(Object.keys(paymentExportRows([payment])[0])).toEqual([
      'Receipt',
      'Reference',
      'Student',
      'Admission no',
      'Amount',
      'Method',
      'Status',
      'Paid at',
      'Reconciled',
      'Recorded by',
    ]);
  });

  it('writes the time the table shows, so a payment just after midnight stays on its own day', () => {
    expect(paymentExportRows([payment])[0]['Paid at']).toBe('2026-09-01 00:30');
  });

  it('leaves a missing receipt number and recorder blank rather than printing "null"', () => {
    const [row] = paymentExportRows([{ ...payment, recordedByName: undefined }]);
    expect(row.Receipt).toBe('');
    expect(row['Recorded by']).toBe('');
  });

  it('keeps the amount a number so Excel can total it', () => {
    expect(paymentExportRows([payment])[0].Amount).toBe(50000);
  });
});

describe('invoiceExportRows', () => {
  const invoice = {
    invoiceNo: 'INV-2026-0007',
    studentName: 'Ada Okafor',
    admissionNo: 'ADM-001',
    className: null,
    termName: 'First term',
    issueDate: '2026-09-01',
    dueDate: '2026-09-30',
    total: 120000,
    amountPaid: 50000,
    balance: 70000,
    status: 'PART_PAID',
  } as unknown as Invoice;

  it('carries the issue date, which is what the period filters on', () => {
    const [row] = invoiceExportRows([invoice]);
    expect(row.Issued).toBe('2026-09-01');
    expect(row.Due).toBe('2026-09-30');
  });

  it('leaves a missing class blank', () => {
    expect(invoiceExportRows([invoice])[0].Class).toBe('');
  });
});
