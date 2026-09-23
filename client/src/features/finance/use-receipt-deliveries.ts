import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ReceiptDeliveryChannel } from '@/types/finance';
import { FinanceEndpoints } from './finance.endpoints';

/**
 * The register of copies of a receipt that have gone out — printed, emailed or
 * sent on WhatsApp (see `ReceiptDeliveriesService` on the server).
 *
 * Emailing and WhatsApp are logged by the server as a side effect of sending,
 * so those two mutations live with the sends themselves in `use-payments`;
 * what is here is the register's own reads and writes. Every one of them also
 * invalidates the payments list, which carries a "receipt sent" mark per row.
 */

export function useReceiptDeliveries(paymentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.receiptDeliveries(schoolId, paymentId ?? ''),
    queryFn: () => FinanceEndpoints.fetchReceiptDeliveries(paymentId ?? ''),
    enabled: Boolean(schoolId && paymentId),
  });
}

/** Records a copy the office sent by its own means — the paper handed over, a posted copy. */
export function useRecordReceiptDelivery(paymentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      channel: ReceiptDeliveryChannel;
      guardianId?: string;
      recipientName?: string;
      recipientContact?: string;
      includeCharges?: boolean;
      note?: string;
      sentAt?: string;
    }) => FinanceEndpoints.recordReceiptDelivery(paymentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receiptDeliveries(schoolId, paymentId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      toast.success('Delivery recorded');
    },
  });
}

/**
 * Notes a print in the register.
 *
 * Deliberately silent: this fires on every print, and a desk printing receipt
 * after receipt does not want a toast each time. A print that fails to log is
 * not worth interrupting anyone over either — the paper is already coming out,
 * and the register can be corrected by hand.
 */
export function useLogReceiptPrint(paymentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { includeCharges: boolean; note?: string }) =>
      FinanceEndpoints.logReceiptPrint(paymentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receiptDeliveries(schoolId, paymentId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
    },
    // A register entry is not worth an error message in front of somebody who
    // has just successfully printed a receipt.
    onError: () => undefined,
  });
}

/** "The family has this" — the one fact only a person at the desk can supply. */
export function useConfirmReceiptDelivery(paymentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deliveryId: string) => FinanceEndpoints.confirmReceiptDelivery(deliveryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receiptDeliveries(schoolId, paymentId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
      toast.success('Marked as delivered');
    },
  });
}
