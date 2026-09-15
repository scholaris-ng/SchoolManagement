import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import { FinanceEndpoints } from './finance.endpoints';
import type { PaymentDestinationInput } from './finance.endpoints';

/**
 * The school's own bank accounts, managed once in one central place — see
 * `PaymentDestination`. A fee item and a custom bill each embed the resolved
 * accounts in their own cached reads, so a save or delete here also
 * invalidates those lists rather than just this one, or a screen already
 * open on a fee item would keep showing an account's old details.
 */

export function usePaymentDestinations() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.paymentDestinations(schoolId),
    queryFn: () => FinanceEndpoints.fetchPaymentDestinations(),
    enabled: Boolean(schoolId),
  });
}

/** Duplicate groups found by matching bank + account number — see `PaymentDestinationDuplicateGroup`. */
export function usePaymentDestinationDuplicates() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.finance.paymentDestinationDuplicates(schoolId),
    queryFn: () => FinanceEndpoints.fetchPaymentDestinationDuplicates(),
    enabled: Boolean(schoolId),
  });
}

function invalidateEverywhereUsed(
  queryClient: ReturnType<typeof useQueryClient>,
  schoolId: ReturnType<typeof useSchoolId>,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.paymentDestinations(schoolId) });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.finance.paymentDestinationDuplicates(schoolId),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.feeItems(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.structures(schoolId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.customBills(schoolId) });
}

export function useSavePaymentDestination() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<PaymentDestinationInput> }) =>
      id
        ? FinanceEndpoints.updatePaymentDestination(id, values)
        : FinanceEndpoints.createPaymentDestination(values as PaymentDestinationInput),
    onSuccess: () => {
      invalidateEverywhereUsed(queryClient, schoolId);
      toast.success('Payment account saved');
    },
  });
}

export function useDeletePaymentDestination() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FinanceEndpoints.deletePaymentDestination(id),
    onSuccess: () => {
      invalidateEverywhereUsed(queryClient, schoolId);
      toast.success('Payment account deleted');
    },
  });
}

/**
 * Folds a group of duplicate accounts into one survivor, repointing every
 * fee item, custom bill and fee structure that referenced a duplicate onto
 * it first — see `PaymentDestinationRepository.merge` on the server.
 */
export function useMergePaymentDestinations() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { keepId: string; mergeIds: string[] }) =>
      FinanceEndpoints.mergePaymentDestinations(input),
    onSuccess: () => {
      invalidateEverywhereUsed(queryClient, schoolId);
      toast.success('Duplicate accounts merged');
    },
  });
}
