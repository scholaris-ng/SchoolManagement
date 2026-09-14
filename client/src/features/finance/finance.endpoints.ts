import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Discount,
  FeeItem,
  FeeStructure,
  FinanceOverview,
  GenerateInvoicesResult,
  Invoice,
  Payment,
  PaymentAccount,
  PaymentMethod,
  PaymentReceiptSubmission,
  Receipt,
  StudentFinanceSummary,
} from '@/types/finance';

/** Type alias so it keeps the implicit index signature the transport needs. */
export type FinanceOverviewQuery = { termId?: string };

export interface CreateInvoiceInput {
  studentId: string;
  termId: string;
  dueDate: string;
  lines: { feeItemId: string; quantity: number; discountAmount: number }[];
  note?: string;
}

export interface RecordPaymentInput {
  studentId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
  allocations?: { invoiceId: string; amount: number }[];
  note?: string;
}

export interface CreatePaymentAccountInput {
  studentId: string;
  amount: number;
  /** The paying guardian's BVN — verified by Raven, never stored by us. */
  bvn: string;
  note?: string;
  /** Ties the account to one bill, so the credit settles it automatically. */
  invoiceId?: string;
}

export interface SubmitPaymentReceiptInput {
  studentId: string;
  invoiceId?: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
  note?: string;
  file: File;
}

/**
 * What the server accepts for a fee structure, which is *not* a `FeeStructure`:
 * a line here names a fee item and a price, where a line coming back also
 * carries its own id and the item's name. Typing the request separately is
 * what stops a screen posting a read model back and being surprised.
 */
export interface FeeStructureInput {
  name: string;
  /** Null means "any term in this session" — the same fees every term. */
  termId: string | null;
  sessionId: string;
  levelIds: string[];
  classIds: string[];
  lines: { feeItemId: string; amount: number; isOptional: boolean }[];
  isActive: boolean;
}

/** Bulk billing: `{ dueDate }`, plus the term where the structure has none. */
export interface GenerateInvoicesInput {
  dueDate: string;
  termId?: string;
  /** Printed bold on every invoice the run creates — a due-date warning, typically. */
  note?: string;
}

/**
 * Endpoint layer for finance.
 *
 * Fee definitions, invoices and payments are deliberately three separate
 * resources: a fee item is what the school charges, an invoice is what a family
 * owes, a payment is what arrived. Balance is derived from the last two, never
 * stored as a single mutable number (spec section 26).
 *
 * Online payments never come through `recordPayment` — those are confirmed by a
 * verified provider webhook server-side, because a browser returning from a
 * payment page proves nothing (spec section 27).
 */
export const FinanceEndpoints = {
  fetchOverview: (query: FinanceOverviewQuery) =>
    http.get<FinanceOverview>('/finance/overview', { query }),

  /* -- Fee definitions ------------------------------------------------------ */

  fetchFeeItems: (query: ListQuery) => http.get<Paginated<FeeItem>>('/fee-items', { query }),

  createFeeItem: (values: Partial<FeeItem>) => http.post<FeeItem>('/fee-items', values),

  updateFeeItem: (id: string, values: Partial<FeeItem>) =>
    http.patch<FeeItem>(`/fee-items/${id}`, values),

  fetchFeeStructures: (query: ListQuery) =>
    http.get<Paginated<FeeStructure>>('/fee-structures', { query }),

  createFeeStructure: (values: Partial<FeeStructureInput>) =>
    http.post<FeeStructure>('/fee-structures', values),

  updateFeeStructure: (id: string, values: Partial<FeeStructureInput>) =>
    http.patch<FeeStructure>(`/fee-structures/${id}`, values),

  /**
   * Bills every pupil the structure covers who has not already been billed for
   * the term. Safe to call twice — the second call reports them all skipped.
   */
  generateInvoices: (id: string, input: GenerateInvoicesInput) =>
    http.post<GenerateInvoicesResult>(`/fee-structures/${id}/generate`, input),

  fetchDiscounts: () => http.get<Discount[]>('/discounts'),

  createDiscount: (values: Partial<Discount>) => http.post<Discount>('/discounts', values),

  updateDiscount: (id: string, values: Partial<Discount>) =>
    http.patch<Discount>(`/discounts/${id}`, values),

  /* -- Invoices ------------------------------------------------------------- */

  fetchInvoices: (query: ListQuery) => http.get<Paginated<Invoice>>('/invoices', { query }),

  fetchInvoice: (id: string) => http.get<Invoice>(`/invoices/${id}`),

  createInvoice: (input: CreateInvoiceInput) => http.post<Invoice>('/invoices', input),

  /* -- Payments ------------------------------------------------------------- */

  fetchPayments: (query: ListQuery) => http.get<Paginated<Payment>>('/payments', { query }),

  recordPayment: (input: RecordPaymentInput) => http.post<Payment>('/payments', input),

  /**
   * A Raven account number for one student to pay one amount into. What lands
   * on it is confirmed by Raven's webhook server-side and appears in
   * `fetchPayments` on its own — nothing the browser does records the money.
   */
  createPaymentAccount: (input: CreatePaymentAccountInput) =>
    http.post<PaymentAccount>('/payments/accounts', input),

  fetchStudentPaymentAccounts: (studentId: string) =>
    http.get<PaymentAccount[]>(`/students/${studentId}/payment-accounts`),

  reconcilePayment: (id: string, note?: string) =>
    http.post<Payment>(`/payments/${id}/reconcile`, { note }),

  fetchReceipt: (paymentId: string) => http.get<Receipt>(`/receipts/${paymentId}`),

  fetchDebtors: (query: ListQuery) =>
    http.get<Paginated<StudentFinanceSummary>>('/debtors', { query }),

  /* -- Payment receipts (parent evidence, office sign-off) ------------------- */

  /**
   * A family's own photograph of a bank slip. Sent as `multipart/form-data`
   * — `http`'s `raw` option skips the usual JSON encoding so the browser sets
   * its own boundary header.
   */
  submitPaymentReceipt: (input: SubmitPaymentReceiptInput) => {
    const form = new FormData();
    form.set('studentId', input.studentId);
    if (input.invoiceId) form.set('invoiceId', input.invoiceId);
    form.set('amount', String(input.amount));
    form.set('method', input.method);
    form.set('paidAt', input.paidAt);
    if (input.reference) form.set('reference', input.reference);
    if (input.note) form.set('note', input.note);
    form.set('file', input.file);
    return http.post<PaymentReceiptSubmission>('/payment-receipts', form, { raw: true });
  },

  fetchPaymentReceipts: (query: ListQuery & { studentId?: string; status?: string }) =>
    http.get<Paginated<PaymentReceiptSubmission>>('/payment-receipts', { query }),

  fetchStudentPaymentReceipts: (studentId: string) =>
    http.get<PaymentReceiptSubmission[]>(`/students/${studentId}/payment-receipts`),

  approvePaymentReceipt: (id: string, note?: string) =>
    http.post<PaymentReceiptSubmission>(`/payment-receipts/${id}/approve`, { note }),

  rejectPaymentReceipt: (id: string, note: string) =>
    http.post<PaymentReceiptSubmission>(`/payment-receipts/${id}/reject`, { note }),
};
