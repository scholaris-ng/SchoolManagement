import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/lib/toast-bus';
import { PlatformEndpoints } from './platform.endpoints';

export function usePlatformSchools() {
  return useQuery({
    queryKey: queryKeys.platform.schools(),
    queryFn: PlatformEndpoints.fetchSchools,
  });
}

export function useActivateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ schoolId, months }: { schoolId: string; months: number }) =>
      PlatformEndpoints.activateSchool(schoolId, months),
    onSuccess: async (school, { months }) => {
      toast.success(`${school.name} activated`, {
        description: `${months} month${months === 1 ? '' : 's'} added. Access now runs until ${formatDate(school.endsAt)}.`,
      });
      // Re-read rather than patch one row: the list is ordered by when each
      // school lapses, and this one has just moved.
      await queryClient.invalidateQueries({ queryKey: queryKeys.platform.schools() });
    },
  });
}

/** The gateway balance is a round trip to KudiSMS, so it is not refetched on every focus. */
export function usePlatformSmsStatus() {
  return useQuery({
    queryKey: queryKeys.platform.smsStatus(),
    queryFn: PlatformEndpoints.fetchSmsStatus,
    staleTime: 60_000,
  });
}

/** A school's SMS credit and recent movements — asked only while the top-up dialog is open. */
export function useSchoolSmsCredits(schoolId: string | null) {
  return useQuery({
    queryKey: queryKeys.platform.smsCredits(schoolId ?? ''),
    queryFn: () => PlatformEndpoints.fetchSmsCredits(schoolId!),
    enabled: schoolId !== null,
  });
}

export function useTopUpSmsCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ schoolId, amountNgn, note }: { schoolId: string; amountNgn: number; note?: string }) =>
      PlatformEndpoints.topUpSmsCredits(schoolId, { amountNgn, note }),
    onSuccess: async (credits, { schoolId, amountNgn }) => {
      toast.success(`${credits.schoolName} topped up`, {
        description: `${formatCurrency(amountNgn, 'NGN', { showDecimals: false })} added ${credits.unitsAdded.toLocaleString()} SMS. Balance is now ${credits.balance.toLocaleString()} SMS.`,
      });
      queryClient.setQueryData(queryKeys.platform.smsCredits(schoolId), credits);
      // The list carries each school's balance too, and the header its total.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.schools() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.smsStatus() }),
      ]);
    },
  });
}
