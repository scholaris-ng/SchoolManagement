import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { FinanceEndpoints } from './finance.endpoints';
import type { SubmitPaymentReceiptInput } from './finance.endpoints';

/**
 * A family's own evidence of an offline payment, and the office's sign-off.
 *
 * Submitting one never touches the ledger — see `PaymentReceiptsService` on
 * the server — so the only thing a family's own screens invalidate is the
 * receipt list itself. Approving or rejecting is what turns it into money,
 * which is why those mutations also invalidate the same queries
 * `useRecordPayment` does.
 */

export function useStudentPaymentReceipts(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.paymentReceipts(schoolId, studentId ?? ''),
    queryFn: () => FinanceEndpoints.fetchStudentPaymentReceipts(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

/** The office's review queue. */
export function usePaymentReceipts(query: ListQuery & { studentId?: string; status?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.allPaymentReceipts(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchPaymentReceipts(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitPaymentReceipt() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitPaymentReceiptInput) => FinanceEndpoints.submitPaymentReceipt(input),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.paymentReceipts(schoolId, receipt.studentId),
      });
      toast.success('Receipt submitted', {
        description: 'The office will check it against the bank statement.',
      });
    },
  });
}

function invalidateAfterReview(
  queryClient: ReturnType<typeof useQueryClient>,
  schoolId: string | null,
  studentId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.allPaymentReceipts(schoolId) });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.finance.paymentReceipts(schoolId, studentId),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.debtors(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.students.ledger(schoolId, studentId) });
}

export function useApprovePaymentReceipt() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      FinanceEndpoints.approvePaymentReceipt(id, note),
    onSuccess: (receipt) => {
      invalidateAfterReview(queryClient, schoolId, receipt.studentId);
      toast.success('Payment receipt approved', { description: receipt.studentName });
    },
  });
}

export function useRejectPaymentReceipt() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      FinanceEndpoints.rejectPaymentReceipt(id, note),
    onSuccess: (receipt) => {
      invalidateAfterReview(queryClient, schoolId, receipt.studentId);
      toast.success('Payment receipt declined', { description: receipt.studentName });
    },
  });
}
