import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
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

/**
 * Finance data access.
 *
 * Fee definitions, invoices and payments are deliberately three separate
 * resources: a fee item is what the school charges, an invoice is what a family
 * owes, a payment is what arrived. Balance is derived from the last two, never
 * stored as a single mutable number (spec section 26).
 */

export function useFinanceOverview(query: { termId?: string } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.overview(schoolId, query),
    queryFn: () => http.get<FinanceOverview>('/finance/overview', { query }),
    enabled: Boolean(schoolId),
  });
}

/* -- Fee definitions -------------------------------------------------------- */

export function useFeeItems(query: ListQuery = { page: 1, pageSize: 100 }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.feeItems(schoolId, query),
    queryFn: () => http.get<Paginated<FeeItem>>('/fee-items', { query }),
    enabled: Boolean(schoolId),
  });
}

export function useSaveFeeItem() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<FeeItem> }) =>
      id ? http.patch<FeeItem>(`/fee-items/${id}`, values) : http.post<FeeItem>('/fee-items', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.feeItems(schoolId) });
      toast.success('Fee item saved');
    },
  });
}

export function useFeeStructures(query: ListQuery = { page: 1, pageSize: 50 }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.structures(schoolId, query),
    queryFn: () => http.get<Paginated<FeeStructure>>('/fee-structures', { query }),
    enabled: Boolean(schoolId),
  });
}

export function useSaveFeeStructure() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<FeeStructure> }) =>
      id
        ? http.patch<FeeStructure>(`/fee-structures/${id}`, values)
        : http.post<FeeStructure>('/fee-structures', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.structures(schoolId) });
      toast.success('Fee structure saved');
    },
  });
}

export function useDiscounts() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.discounts(schoolId),
    queryFn: () => http.get<Discount[]>('/discounts'),
    enabled: Boolean(schoolId),
  });
}

export function useSaveDiscount() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<Discount> }) =>
      id
        ? http.patch<Discount>(`/discounts/${id}`, values)
        : http.post<Discount>('/discounts', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.discounts(schoolId) });
      toast.success('Discount saved');
    },
  });
}

/* -- Invoices --------------------------------------------------------------- */

/**
 * `enabled` lets a caller hold the request back until the thing it filters on
 * is known — the parent portal, for instance, must not fetch every child's
 * invoices in the moment before it knows which child is selected.
 */
export function useInvoices(query: ListQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.invoices(schoolId, query),
    queryFn: () => http.get<Paginated<Invoice>>('/invoices', { query }),
    enabled: Boolean(schoolId) && options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.invoice(schoolId, id ?? ''),
    queryFn: () => http.get<Invoice>(`/invoices/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export interface CreateInvoiceInput {
  studentId: string;
  termId: string;
  dueDate: string;
  lines: { feeItemId: string; quantity: number; discountAmount: number }[];
  note?: string;
}

export function useCreateInvoice() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => http.post<Invoice>('/invoices', input),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });
      toast.success('Invoice created', { description: invoice.invoiceNo });
    },
  });
}

/* -- Payments --------------------------------------------------------------- */

export function usePayments(query: ListQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.payments(schoolId, query),
    queryFn: () => http.get<Paginated<Payment>>('/payments', { query }),
    enabled: Boolean(schoolId) && options.enabled !== false,
    placeholderData: keepPreviousData,
  });
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
 * Recording a payment that arrived by cash, transfer or POS.
 *
 * Online payments never come through here — those are confirmed by a verified
 * provider webhook server-side, because a browser returning from a payment page
 * proves nothing (spec section 27).
 */
export function useRecordPayment() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput) => http.post<Payment>('/payments', input),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.debtors(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.ledger(schoolId, payment.studentId),
      });
      toast.success('Payment recorded', { description: payment.receiptNo ?? payment.reference });
    },
  });
}

export function useReconcilePayment() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      http.post<Payment>(`/payments/${id}/reconcile`, { note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });
      toast.success('Payment reconciled');
    },
  });
}

export function useReceipt(paymentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.receipt(schoolId, paymentId ?? ''),
    queryFn: () => http.get<Receipt>(`/receipts/${paymentId}`),
    enabled: Boolean(schoolId && paymentId),
  });
}

export function useDebtors(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.debtors(schoolId, query),
    queryFn: () => http.get<Paginated<StudentFinanceSummary>>('/debtors', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}
