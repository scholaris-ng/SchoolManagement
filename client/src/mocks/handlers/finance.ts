import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';
import type { Invoice, Payment, StudentLedgerEntry } from '@/types/finance';

const base = '/api/v1';
let sequence = 700_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/**
 * Balances are always derived here — from invoices and payments — never read
 * from a stored field, which is the invariant the finance module depends on.
 */
function ledgerFor(schoolId: string, studentId: string) {
  const invoices = db.invoices.filter(
    (invoice) => invoice.schoolId === schoolId && invoice.studentId === studentId,
  );
  const payments = db.payments.filter(
    (payment) =>
      payment.schoolId === schoolId &&
      payment.studentId === studentId &&
      payment.status === 'SUCCESSFUL',
  );

  const entries: StudentLedgerEntry[] = [
    ...invoices.map((invoice) => ({
      id: `inv_${invoice.id}`,
      date: invoice.issueDate,
      type: 'INVOICE' as const,
      reference: invoice.invoiceNo,
      description: `${invoice.termName} fees`,
      debit: invoice.total,
      credit: 0,
      runningBalance: 0,
    })),
    ...invoices
      .filter((invoice) => invoice.discountTotal > 0)
      .map((invoice) => ({
        id: `dsc_${invoice.id}`,
        date: invoice.issueDate,
        type: 'DISCOUNT' as const,
        reference: invoice.invoiceNo,
        description: 'Discount applied',
        debit: 0,
        credit: 0,
        runningBalance: 0,
      })),
    ...payments.map((payment) => ({
      id: `pay_${payment.id}`,
      date: payment.paidAt.slice(0, 10),
      type: 'PAYMENT' as const,
      reference: payment.receiptNo ?? payment.reference,
      description: `Payment by ${payment.method.toLowerCase().replace('_', ' ')}`,
      debit: 0,
      credit: payment.amount,
      runningBalance: 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  entries.forEach((entry) => {
    running += entry.debit - entry.credit;
    entry.runningBalance = running;
  });

  const student = db.students.find((entry) => entry.id === studentId);
  const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    entries,
    summary: {
      studentId,
      studentName: student?.fullName ?? '',
      admissionNo: student?.admissionNo ?? '',
      className: student?.currentClassName ?? null,
      totalBilled,
      totalPaid,
      totalDiscount: invoices.reduce((sum, invoice) => sum + invoice.discountTotal, 0),
      balance: totalBilled - totalPaid,
      lastPaymentAt: payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0]?.paidAt ?? null,
      overdueInvoices: invoices.filter((invoice) => invoice.status === 'OVERDUE').length,
    },
  };
}

export const financeHandlers = [
  http.get(`${base}/finance/overview`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const invoices = scoped(db.invoices, context.schoolId);
    const payments = scoped(db.payments, context.schoolId).filter((p) => p.status === 'SUCCESSFUL');

    const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const unreconciled = payments.filter((payment) => !payment.isReconciled);

    const byCategory = new Map<string, { billed: number; collected: number }>();
    invoices.forEach((invoice) => {
      invoice.lines.forEach((line) => {
        const item = db.feeItems.find((entry) => entry.id === line.feeItemId);
        const key = item?.category ?? 'OTHER';
        const bucket = byCategory.get(key) ?? { billed: 0, collected: 0 };
        bucket.billed += line.lineTotal;
        bucket.collected += invoice.total > 0 ? (line.lineTotal / invoice.total) * invoice.amountPaid : 0;
        byCategory.set(key, bucket);
      });
    });

    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const collectionTrend = months.map((label, index) => ({
      label,
      billed: Math.round(totalBilled / months.length),
      collected: Math.round((totalCollected / months.length) * (0.6 + index * 0.12)),
    }));

    return ok({
      currency: 'NGN',
      totalBilled,
      totalCollected,
      totalOutstanding: totalBilled - totalCollected,
      totalDiscount: invoices.reduce((sum, invoice) => sum + invoice.discountTotal, 0),
      collectionRate: totalBilled ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0,
      debtorCount: invoices.filter((invoice) => invoice.balance > 0).length,
      unreconciledCount: unreconciled.length,
      unreconciledAmount: unreconciled.reduce((sum, payment) => sum + payment.amount, 0),
      collectionTrend,
      byCategory: Array.from(byCategory, ([category, value]) => ({
        category,
        billed: Math.round(value.billed),
        collected: Math.round(value.collected),
      })),
    });
  }),

  http.get(`${base}/fee-items`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    return ok(paginate(scoped(db.feeItems, context.schoolId), page, pageSize));
  }),

  http.post(`${base}/fee-items`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('fee.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | number | boolean>;
    const item = {
      id: nextId('fee'),
      schoolId: context.schoolId,
      name: String(body.name),
      code: String(body.code),
      description: (body.description as string) || null,
      amount: Number(body.amount),
      category: body.category as never,
      isOptional: Boolean(body.isOptional),
      isRecurring: Boolean(body.isRecurring),
      isActive: true,
    };
    db.feeItems.push(item);
    return created(item, 'Fee item saved');
  }),

  http.get(`${base}/fee-structures`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    return ok(paginate(scoped(db.feeStructures, context.schoolId), page, pageSize));
  }),

  http.get(`${base}/discounts`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();
    return ok(scoped(db.discounts, context.schoolId));
  }),

  http.get(`${base}/invoices`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const status = url.searchParams.get('status');
    const termId = url.searchParams.get('termId');
    const classId = url.searchParams.get('classId');
    const studentId = url.searchParams.get('studentId');
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.invoices, context.schoolId);
    if (allowed) rows = rows.filter((invoice) => allowed.includes(invoice.studentId));

    rows = rows.filter((invoice) => {
      if (status && invoice.status !== status) return false;
      if (termId && invoice.termId !== termId) return false;
      if (studentId && invoice.studentId !== studentId) return false;
      if (classId) {
        const student = db.students.find((entry) => entry.id === invoice.studentId);
        if (student?.currentClassId !== classId) return false;
      }
      return matchesSearch([invoice.invoiceNo, invoice.studentName, invoice.admissionNo], search);
    });

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/invoices/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const invoice = scoped(db.invoices, context.schoolId).find((entry) => entry.id === params.id);
    return invoice ? ok(invoice) : errors.notFound('Invoice');
  }),

  http.post(`${base}/invoices`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('invoice.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      studentId: string;
      termId: string;
      dueDate: string;
      lines: { feeItemId: string; quantity: number; discountAmount: number }[];
      note?: string;
    };

    const student = db.students.find((entry) => entry.id === body.studentId);
    const term = db.terms.find((entry) => entry.id === body.termId);
    if (!student || !term) return errors.validation('Select a student and a term.');

    const lines = body.lines.map((line) => {
      const item = db.feeItems.find((entry) => entry.id === line.feeItemId)!;
      const lineTotal = item.amount * line.quantity - line.discountAmount;
      return {
        id: nextId('inl'),
        feeItemId: item.id,
        description: item.name,
        quantity: line.quantity,
        unitAmount: item.amount,
        discountAmount: line.discountAmount,
        lineTotal,
        isOptional: item.isOptional,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
    const discountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);

    // Unpaid balances follow the student into the new invoice rather than
    // disappearing at the term boundary (spec section 26).
    const { summary } = ledgerFor(context.schoolId, student.id);
    const broughtForward = Math.max(0, summary.balance);
    const total = subtotal - discountTotal + broughtForward;

    const invoice: Invoice = {
      id: nextId('inv'),
      schoolId: context.schoolId,
      invoiceNo: `INV/${new Date().getFullYear()}/${String(db.invoices.length + 1).padStart(5, '0')}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      className: student.currentClassName,
      sessionId: term.sessionId,
      sessionName: term.sessionName,
      termId: term.id,
      termName: term.name,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate,
      lines,
      subtotal,
      discountTotal,
      broughtForward,
      total,
      amountPaid: 0,
      balance: total,
      status: 'ISSUED',
      note: body.note ?? null,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    db.invoices.unshift(invoice);
    return created(invoice, 'Invoice created');
  }),

  http.get(`${base}/payments`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const method = url.searchParams.get('method');
    const reconciled = url.searchParams.get('isReconciled');
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.payments, context.schoolId);
    if (allowed) rows = rows.filter((payment) => allowed.includes(payment.studentId));

    rows = rows
      .filter(
        (payment) =>
          (!method || payment.method === method) &&
          (!reconciled || String(payment.isReconciled) === reconciled) &&
          matchesSearch(
            [payment.reference, payment.studentName, payment.admissionNo, payment.receiptNo],
            search,
          ),
      )
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/payments`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('payment.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      studentId: string;
      amount: number;
      method: Payment['method'];
      paidAt: string;
      reference?: string;
      allocations?: { invoiceId: string; amount: number }[];
      note?: string;
    };

    const student = db.students.find((entry) => entry.id === body.studentId);
    if (!student) return errors.validation('Select a student.');
    if (body.amount <= 0) {
      return errors.validation('The amount must be greater than zero.', [
        { field: 'amount', message: 'Enter an amount greater than zero.' },
      ]);
    }

    // Oldest invoice first when the bursar has not allocated explicitly.
    const outstanding = scoped(db.invoices, context.schoolId)
      .filter((invoice) => invoice.studentId === student.id && invoice.balance > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let remaining = body.amount;
    const allocations = (body.allocations?.length
      ? body.allocations
      : outstanding.map((invoice) => ({ invoiceId: invoice.id, amount: 0 }))
    )
      .map((allocation) => {
        const invoice = db.invoices.find((entry) => entry.id === allocation.invoiceId);
        if (!invoice || remaining <= 0) return null;
        const amount = allocation.amount > 0 ? Math.min(allocation.amount, remaining) : Math.min(invoice.balance, remaining);
        if (amount <= 0) return null;
        remaining -= amount;
        invoice.amountPaid += amount;
        invoice.balance = invoice.total - invoice.amountPaid;
        invoice.status = invoice.balance <= 0 ? 'PAID' : 'PART_PAID';
        return {
          id: nextId('pal'),
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          amount,
        };
      })
      .filter((allocation): allocation is NonNullable<typeof allocation> => allocation !== null);

    const receiptNo = `RCP/${new Date().getFullYear()}/${String(db.payments.length + 1).padStart(5, '0')}`;

    const payment: Payment = {
      id: nextId('pay'),
      schoolId: context.schoolId,
      reference: body.reference || `PAY-${Date.now()}`,
      providerReference: null,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      guardianName:
        db.studentGuardians.find((link) => link.studentId === student.id)?.guardianName ?? null,
      amount: body.amount,
      method: body.method,
      provider: body.method === 'ONLINE' ? 'PAYSTACK' : 'MANUAL',
      status: 'SUCCESSFUL',
      paidAt: new Date(body.paidAt).toISOString(),
      recordedByName: context.user.displayName,
      allocations,
      unallocatedAmount: remaining,
      isReconciled: body.method !== 'CASH',
      receiptNo,
      note: body.note ?? null,
    };

    db.payments.unshift(payment);

    db.auditLog.unshift({
      id: nextId('aud'),
      schoolId: context.schoolId,
      actorUserId: context.user.id,
      actorName: context.user.displayName,
      actorRole: context.membership.roles[0] ?? 'Member',
      action: 'payment.recorded',
      entityType: 'Payment',
      entityId: payment.id,
      entityLabel: `${payment.reference} — ${student.fullName}`,
      before: null,
      after: { amount: payment.amount, method: payment.method },
      ipAddress: null,
      userAgent: null,
      requestId: request.headers.get('x-request-id'),
      occurredAt: new Date().toISOString(),
      severity: 'INFO',
    });

    return created(payment, 'Payment recorded');
  }),

  http.post(`${base}/payments/:id/reconcile`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('payment.reconcile')) return errors.forbidden();

    const payment = scoped(db.payments, context.schoolId).find((entry) => entry.id === params.id);
    if (!payment) return errors.notFound('Payment');
    payment.isReconciled = true;
    return ok(payment, 'Payment reconciled');
  }),

  http.get(`${base}/receipts/:paymentId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const payment = scoped(db.payments, context.schoolId).find(
      (entry) => entry.id === params.paymentId,
    );
    if (!payment) return errors.notFound('Receipt');

    const school = db.schools.find((entry) => entry.id === context.schoolId)!;
    const { summary } = ledgerFor(context.schoolId, payment.studentId);
    const student = db.students.find((entry) => entry.id === payment.studentId);

    return ok({
      id: payment.id,
      receiptNo: payment.receiptNo ?? payment.reference,
      paymentId: payment.id,
      schoolName: school.name,
      schoolLogoUrl: school.branding.logoUrl,
      schoolAddress: `${school.addressLine1}, ${school.city}, ${school.state}`,
      studentName: payment.studentName,
      admissionNo: payment.admissionNo,
      className: student?.currentClassName ?? null,
      amount: payment.amount,
      amountInWords: '',
      method: payment.method,
      paidAt: payment.paidAt,
      receivedByName: payment.recordedByName ?? '',
      allocations: payment.allocations.map((allocation) => ({
        invoiceNo: allocation.invoiceNo,
        description: 'School fees',
        amount: allocation.amount,
      })),
      balanceAfter: summary.balance,
      verificationCode: `${school.code}-RCP-${payment.id.slice(-6).toUpperCase()}`,
    });
  }),

  http.get(`${base}/students/:id/ledger`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.id))) return errors.forbidden();

    return ok(ledgerFor(context.schoolId, String(params.id)));
  }),

  http.get(`${base}/debtors`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const minBalance = Number(url.searchParams.get('minBalance') ?? 0);

    const rows = scoped(db.students, context.schoolId)
      .filter((student) => student.status === 'ACTIVE')
      .map((student) => ledgerFor(context.schoolId, student.id).summary)
      .filter(
        (summary) =>
          summary.balance > minBalance &&
          matchesSearch([summary.studentName, summary.admissionNo, summary.className], search),
      )
      .sort((a, b) => b.balance - a.balance);

    return ok(paginate(rows, page, pageSize));
  }),
];

export { ledgerFor };
