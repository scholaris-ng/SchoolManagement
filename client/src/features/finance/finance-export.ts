import { formatDate } from '@/lib/format';
import type { ListQuery } from '@/types/api';
import type { Invoice, Payment } from '@/types/finance';

/** What each row of the Payments export holds. Column order is the order here. */
export function paymentExportRows(payments: Payment[]): Record<string, unknown>[] {
  return payments.map((payment) => ({
    Receipt: payment.receiptNo ?? '',
    Reference: payment.reference,
    Student: payment.studentName,
    'Admission no': payment.admissionNo,
    Amount: payment.amount,
    Method: payment.method,
    Status: payment.status,
    // Local time, to the minute, so a row reads the way the table does and sits
    // inside the period it was filtered by. The raw value is a UTC instant, and
    // a payment just after midnight would otherwise export as the day before.
    'Paid at': formatDate(payment.paidAt, 'yyyy-MM-dd HH:mm'),
    Reconciled: payment.isReconciled ? 'Yes' : 'No',
    'Recorded by': payment.recordedByName ?? '',
  }));
}

export function invoiceExportRows(invoices: Invoice[]): Record<string, unknown>[] {
  return invoices.map((invoice) => ({
    Invoice: invoice.invoiceNo,
    Student: invoice.studentName,
    'Admission no': invoice.admissionNo,
    Class: invoice.className ?? '',
    Term: invoice.termName,
    Issued: invoice.issueDate,
    Due: invoice.dueDate,
    Total: invoice.total,
    Paid: invoice.amountPaid,
    Balance: invoice.balance,
    Status: invoice.status,
  }));
}

/**
 * The period is in the name, so a folder of monthly exports sorts and reads
 * without opening any of them: `payments-2026-09-01_to_2026-09-30.xlsx`.
 * With no interval set it is the day of export, as it always was.
 */
export function exportFileName(base: string, query: ListQuery, now = new Date()): string {
  const from = typeof query.dateFrom === 'string' ? query.dateFrom : undefined;
  const to = typeof query.dateTo === 'string' ? query.dateTo : undefined;

  if (from && to) return `${base}-${from}_to_${to}.xlsx`;
  if (from) return `${base}-from-${from}.xlsx`;
  if (to) return `${base}-until-${to}.xlsx`;
  return `${base}-${now.toISOString().slice(0, 10)}.xlsx`;
}
