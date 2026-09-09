import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { AnalyticsEndpoints } from './analytics.endpoints';

/**
 * Withdrawal-risk analytics.
 *
 * The score itself is computed server-side from the ledger, the register and
 * guardian engagement — the client only renders the ranking and the signals
 * behind it, so the model can be tuned without shipping a new bundle.
 */
export function useRetentionRisk(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.dashboard.retention(schoolId, query),
    queryFn: () => AnalyticsEndpoints.fetchRetentionRisk(query),
    enabled: Boolean(schoolId),
    // The signals move daily at most; refetching on every focus is wasted data
    // on a metered connection.
    staleTime: 5 * 60_000,
  });
}
