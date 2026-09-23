import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { DeliveryChannel, DeliveryDocumentType, PrintFormat } from '@/types/finance';
import { FinanceEndpoints } from './finance.endpoints';

/**
 * The register of finance documents that have gone out (see
 * `DocumentDeliveriesService` on the server).
 *
 * Emailing and sharing are logged by the server as a side effect of sending, so
 * those mutations live with the sends themselves; what is here is the register's
 * own reads and writes. Each write also invalidates the payments and invoices
 * lists, which carry a "sent" mark per row.
 */

/** The whole register, for the "Documents sent" screen. */
export function useDeliveries(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.deliveries(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchDeliveries(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

/** One document's own history, for the card on its page. */
export function useDocumentDeliveries(
  documentType: DeliveryDocumentType,
  documentId: string | undefined,
) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.documentDeliveries(schoolId, documentType, documentId ?? ''),
    queryFn: () => FinanceEndpoints.fetchDocumentDeliveries(documentType, documentId ?? ''),
    enabled: Boolean(schoolId && documentId),
  });
}

/** Every list that carries a "sent" mark, plus the register itself. */
function invalidateAfterDelivery(
  queryClient: ReturnType<typeof useQueryClient>,
  schoolId: string | null,
  documentType: DeliveryDocumentType,
  documentId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.finance.documentDeliveries(schoolId, documentType, documentId),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.deliveries(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
}

/** Records a copy the office sent by its own means — the paper handed over, a posted copy. */
export function useRecordDelivery(documentType: DeliveryDocumentType, documentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      channel: DeliveryChannel;
      guardianId?: string;
      recipientName?: string;
      recipientContact?: string;
      printFormat?: PrintFormat;
      includeCharges?: boolean;
      note?: string;
      sentAt?: string;
    }) => FinanceEndpoints.recordDelivery(documentType, documentId, input),
    onSuccess: () => {
      invalidateAfterDelivery(queryClient, schoolId, documentType, documentId);
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
export function useLogDocumentPrint(documentType: DeliveryDocumentType, documentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { printFormat: PrintFormat; includeCharges: boolean; note?: string }) =>
      FinanceEndpoints.logDocumentPrint(documentType, documentId, input),
    onSuccess: () => invalidateAfterDelivery(queryClient, schoolId, documentType, documentId),
    // A register entry is not worth an error message in front of somebody who
    // has just successfully printed a document.
    onError: () => undefined,
  });
}

/** "The family has this" — the one fact only a person at the desk can supply. */
export function useConfirmDelivery(documentType: DeliveryDocumentType, documentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deliveryId: string) => FinanceEndpoints.confirmDelivery(deliveryId),
    onSuccess: () => {
      invalidateAfterDelivery(queryClient, schoolId, documentType, documentId);
      toast.success('Marked as delivered');
    },
  });
}

/** The register itself, plus every list that carries a "sent" mark — invalidated after any register-wide write. */
function invalidateRegister(
  queryClient: ReturnType<typeof useQueryClient>,
  schoolId: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.deliveries(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
}

/**
 * Confirming from the register, where rows are of every kind at once — so there
 * is no single document whose card to refresh, only the register and the lists.
 */
export function useConfirmDeliveryFromRegister() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deliveryId: string) => FinanceEndpoints.confirmDelivery(deliveryId),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.documentDeliveries(
          schoolId,
          delivery.documentType,
          delivery.documentId,
        ),
      });
      invalidateRegister(queryClient, schoolId);
      toast.success('Marked as delivered');
    },
  });
}

/**
 * "Mark all as delivered" for whatever the register is currently filtered to.
 *
 * Takes the register's own filter object as its argument rather than closing
 * over it, so the mutation always confirms exactly what is on screen at the
 * moment it is clicked — even if a filter changes while the request is in
 * flight, this cannot end up scoped to a stale one.
 */
export function useConfirmAllDeliveries() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: ListQuery) => FinanceEndpoints.confirmAllDeliveries(query),
    onSuccess: ({ confirmed }) => {
      invalidateRegister(queryClient, schoolId);
      // No per-document cache to invalidate here, unlike a single confirm: a
      // bulk confirm can touch documents whose own delivery-log card is not
      // even open right now, so there is nothing narrower worth targeting.
      if (confirmed === 0) {
        toast.info('Nothing to confirm', {
          description: 'Every copy matching these filters is already delivered, failed, or there is nothing here.',
        });
      } else {
        toast.success(confirmed === 1 ? '1 copy marked as delivered' : `${confirmed} copies marked as delivered`);
      }
    },
  });
}
