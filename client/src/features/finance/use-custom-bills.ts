import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { FinanceEndpoints } from './finance.endpoints';
import type { CustomBillInput } from './finance.endpoints';

/**
 * One-off bills outside the real ledger — a contractor, a visitor, a charge
 * with no enrolled student behind it. See `CustomBill` for why these never
 * touch a balance, the debtors list, or payment allocation.
 */

export function useCustomBills(query: ListQuery = { page: 1, pageSize: 20 }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.customBills(schoolId, query),
    queryFn: () => FinanceEndpoints.fetchCustomBills(query),
    enabled: Boolean(schoolId),
  });
}

export function useCustomBill(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.customBill(schoolId, id ?? ''),
    queryFn: () => FinanceEndpoints.fetchCustomBill(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useSaveCustomBill() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<CustomBillInput> }) =>
      id ? FinanceEndpoints.updateCustomBill(id, values) : FinanceEndpoints.createCustomBill(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.customBills(schoolId) });
      toast.success('Bill saved');
    },
  });
}

export function useDeleteCustomBill() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FinanceEndpoints.deleteCustomBill(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.customBills(schoolId) });
      toast.success('Bill deleted');
    },
  });
}
