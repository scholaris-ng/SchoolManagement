import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { Discount, FeeItem, FeeStructure } from '@/types/finance';
import { FinanceEndpoints } from './finance.endpoints';
import type { FinanceOverviewQuery } from './finance.endpoints';

/**
 * What the school charges: the overview, fee items, structures and discounts.
 *
 * These are definitions, not money. An invoice is what a family owes and a
 * payment is what arrived; balance is derived from those two, never stored as a
 * single mutable number (spec section 26).
 */

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
