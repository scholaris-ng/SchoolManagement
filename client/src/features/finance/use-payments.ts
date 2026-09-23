import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { FinanceEndpoints } from './finance.endpoints';
import type { CreatePaymentAccountInput, RecordPaymentInput } from './finance.endpoints';

/**
 * What arrived, and who still owes.
 *
 * Online payments never come through `useRecordPayment` — those are confirmed
 * by a verified provider webhook server-side, because a browser returning from
 * a payment page proves nothing (spec section 27).
 */

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

/** The Raven account numbers issued for one student, newest first. */
export function useStudentPaymentAccounts(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.paymentAccounts(schoolId, studentId ?? ''),
    queryFn: () => FinanceEndpoints.fetchStudentPaymentAccounts(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

/**
 * Asks Raven for an account number a family can pay into. Nothing here
 * records money: the credit arrives through Raven's webhook and shows up in
 * `usePayments` when it does.
 */
export function useCreatePaymentAccount() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentAccountInput) => FinanceEndpoints.createPaymentAccount(input),
    onSuccess: (account) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.paymentAccounts(schoolId, account.studentId),
      });
      toast.success('Payment account ready', {
        description: `${account.bankName} · ${account.accountNumber}`,
      });
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

/**
 * Undoes a payment recorded wrongly. It touches everything a new payment
 * does, in reverse: the invoices it settled reopen, the student's balance
 * rises, and the debtors list and dashboards move with them.
 */
export function useReversePayment() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      FinanceEndpoints.reversePayment(id, reason),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.debtors(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receipt(schoolId, payment.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.ledger(schoolId, payment.studentId),
      });
      toast.success('Payment reversed', { description: payment.receiptNo ?? payment.reference });
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

/**
 * Saves which of one invoice's fee items this receipt is marked as having
 * paid for. The server hands back the whole receipt, so the cache is written
 * straight from the response rather than refetched — a toggle should feel
 * instant, not wait a round trip and a second one.
 */
export function useMarkReceiptItems(paymentId: string | undefined) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, lineIds }: { invoiceId: string; lineIds: string[] }) =>
      FinanceEndpoints.markReceiptItems(paymentId ?? '', invoiceId, lineIds),
    onSuccess: (receipt) => {
      queryClient.setQueryData(queryKeys.finance.receipt(schoolId, paymentId ?? ''), receipt);
    },
    onError: () => {
      toast.error('Could not save which fee items were paid for');
    },
  });
}

/**
 * Saves how much of this payment each of an invoice's charges took. Unlike
 * `useMarkReceiptItems` this moves real money between charges, so every
 * screen that reads a per-charge balance — the invoice itself above all — is
 * refetched alongside writing the receipt back into the cache.
 */
export function useSetReceiptItemAmounts(paymentId: string | undefined) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, lines }: { invoiceId: string; lines: { lineId: string; amount: number }[] }) =>
      FinanceEndpoints.setReceiptItemAmounts(paymentId ?? '', invoiceId, lines),
    onSuccess: (receipt, variables) => {
      queryClient.setQueryData(queryKeys.finance.receipt(schoolId, paymentId ?? ''), receipt);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.invoice(schoolId, variables.invoiceId),
      });
      toast.success('Fee item amounts saved');
    },
    onError: () => {
      toast.error('Could not save the amounts for those fee items');
    },
  });
}

export function useSendReceiptEmail(paymentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guardianId, includeCharges }: { guardianId: string; includeCharges: boolean }) =>
      FinanceEndpoints.sendReceiptEmail(paymentId, guardianId, includeCharges),
    onSuccess: (result) => {
      // The server logs the send in the receipt's delivery register, and the
      // payments list carries a "sent" mark per row — both go stale here.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receiptDeliveries(schoolId, paymentId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      toast.success('Receipt emailed', { description: result.email });
    },
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
