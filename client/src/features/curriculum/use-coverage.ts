import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import { CurriculumEndpoints } from './curriculum.endpoints';
import type { CoverageQuery, MarkCoverageInput } from './curriculum.endpoints';

/** Which objectives were actually taught and actually assessed. */

export function useCurriculumCoverage(query: CoverageQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.coverage(schoolId, query),
    queryFn: () => CurriculumEndpoints.fetchCoverage(query),
    enabled: Boolean(schoolId && query.curriculumId),
  });
}

/**
 * Marking objective coverage — taught, assessed, or both.
 *
 * This is the entry point for the coverage analytics: a school can only find
 * the gap between "on the syllabus," "actually taught" and "actually tested"
 * if a teacher can record each difference in a couple of clicks (spec section
 * 13). The server enforces that an objective cannot be assessed without
 * being taught, so unmarking "taught" clears "assessed" with it.
 */
export function useMarkObjectiveCoverage(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MarkCoverageInput) =>
      CurriculumEndpoints.markCoverage(curriculumId, input),
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.coverage(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      const count = `${result.updated} objective${result.updated === 1 ? '' : 's'}`;
      const label =
        input.taught !== undefined
          ? input.taught
            ? 'taught'
            : 'not taught'
          : input.assessed
            ? 'assessed'
            : 'not assessed';
      toast.success(`${count} marked as ${label}`);
    },
  });
}
