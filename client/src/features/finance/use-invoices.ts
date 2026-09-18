import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { FinanceEndpoints } from './finance.endpoints';
import type { CreateInvoiceInput, UpdateInvoiceInput } from './finance.endpoints';

/** What a family owes. */

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

export function useUpdateInvoice() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInvoiceInput }) =>
      FinanceEndpoints.updateInvoice(id, input),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoice(schoolId, invoice.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
      toast.success('Invoice updated', { description: invoice.invoiceNo });
    },
  });
}

/** Emails one invoice to a guardian already linked to its student. */
export function useSendInvoiceEmail(invoiceId: string) {
  return useMutation({
    mutationFn: (guardianId: string) => FinanceEndpoints.sendInvoiceEmail(invoiceId, guardianId),
    onSuccess: (result) => {
      toast.success('Invoice emailed', { description: result.email });
    },
  });
}

/**
 * A batch is not all-or-nothing: whatever was safe to delete is gone, and
 * the toast names anything that was not, and why — see `DeleteInvoicesResult`.
 */
export function useDeleteInvoices() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => FinanceEndpoints.deleteInvoices(ids),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.overview(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bursar(schoolId) });

      if (result.deletedIds.length > 0) {
        toast.success(
          result.deletedIds.length === 1
            ? 'Invoice deleted'
            : `${result.deletedIds.length} invoices deleted`,
        );
      }
      if (result.skipped.length > 0) {
        toast.error(
          result.skipped.length === 1
            ? `${result.skipped[0].invoiceNo || 'One invoice'} was not deleted`
            : `${result.skipped.length} invoices were not deleted`,
          {
            description:
              result.skipped.length === 1
                ? result.skipped[0].reason
                : result.skipped
                    .map((row) => `${row.invoiceNo || 'Unknown'}: ${row.reason}`)
                    .join(' · '),
          },
        );
      }
    },
  });
}
