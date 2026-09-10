import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { FinanceEndpoints } from './finance.endpoints';
import type { CreateInvoiceInput } from './finance.endpoints';

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
