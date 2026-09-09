import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Discount,
  FeeItem,
  FeeStructure,
  FinanceOverview,
  Invoice,
  Payment,
  PaymentMethod,
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

  createFeeStructure: (values: Partial<FeeStructure>) =>
    http.post<FeeStructure>('/fee-structures', values),

  updateFeeStructure: (id: string, values: Partial<FeeStructure>) =>
    http.patch<FeeStructure>(`/fee-structures/${id}`, values),

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

  reconcilePayment: (id: string, note?: string) =>
    http.post<Payment>(`/payments/${id}/reconcile`, { note }),

  fetchReceipt: (paymentId: string) => http.get<Receipt>(`/receipts/${paymentId}`),

  fetchDebtors: (query: ListQuery) =>
    http.get<Paginated<StudentFinanceSummary>>('/debtors', { query }),
};
