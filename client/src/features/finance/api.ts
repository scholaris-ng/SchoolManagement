import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { Discount, FeeItem, FeeStructure } from '@/types/finance';
import { FinanceEndpoints } from './finance.endpoints';
import type {
  CreateInvoiceInput,
  FinanceOverviewQuery,
  RecordPaymentInput,
} from './finance.endpoints';

export type { CreateInvoiceInput, FinanceOverviewQuery, RecordPaymentInput };

export function useFinanceOverview(query: FinanceOverviewQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.overview(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchOverview(query),
    enabled: Boolean(schoolId),
  });
}

/* -- Fee definitions -------------------------------------------------------- */

export function useFeeItems(query: ListQuery = { page: 1, pageSize: 100 }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.feeItems(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchFeeItems(query),
    enabled: Boolean(schoolId),
  });
}

export function useSaveFeeItem() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<FeeItem> }) =>
      id ? FinanceEndpoints.updateFeeItem(id, values) : FinanceEndpoints.createFeeItem(values),
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
    queryFn: () => FinanceEndpoints.fetchFeeStructures(query),
    enabled: Boolean(schoolId),
  });
}

export function useSaveFeeStructure() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<FeeStructure> }) =>
      id
        ? FinanceEndpoints.updateFeeStructure(id, values)
        : FinanceEndpoints.createFeeStructure(values),
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
    queryFn: () => FinanceEndpoints.fetchDiscounts(),
    enabled: Boolean(schoolId),
  });
}

export function useSaveDiscount() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<Discount> }) =>
      id ? FinanceEndpoints.updateDiscount(id, values) : FinanceEndpoints.createDiscount(values),
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
    queryFn: () => FinanceEndpoints.fetchInvoices(query),
    enabled: Boolean(schoolId) && options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.invoice(schoolId, id ?? ''),
    queryFn: () => FinanceEndpoints.fetchInvoice(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useCreateInvoice() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => FinanceEndpoints.createInvoice(input),
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
    queryFn: () => FinanceEndpoints.fetchPayments(query),
    enabled: Boolean(schoolId) && options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

/** Records a payment that arrived by cash, transfer or POS. */
export function useRecordPayment() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput) => FinanceEndpoints.recordPayment(input),
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
      FinanceEndpoints.reconcilePayment(id, note),
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
    queryFn: () => FinanceEndpoints.fetchReceipt(paymentId ?? ''),
    enabled: Boolean(schoolId && paymentId),
  });
}

export function useDebtors(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.debtors(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchDebtors(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}
