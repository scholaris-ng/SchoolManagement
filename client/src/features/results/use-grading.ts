import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { GradingScheme } from '@/types/results';
import { ResultsEndpoints } from './results.endpoints';

/** How raw marks become grades. */

export function useGradingSchemes() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.schemes(schoolId),
    queryFn: () => ResultsEndpoints.fetchGradingSchemes(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveGradingScheme() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<GradingScheme> }) =>
      id
        ? ResultsEndpoints.updateGradingScheme(id, values)
        : ResultsEndpoints.createGradingScheme(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.schemes(schoolId) });
      toast.success('Grading scheme saved');
    },
  });
}
