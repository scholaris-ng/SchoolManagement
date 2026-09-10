import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { SchemeOfWork } from '@/types/curriculum';
import { CurriculumEndpoints } from './curriculum.endpoints';
import type { GenerateSchemeInput } from './curriculum.endpoints';

/** Schemes of work — the term plan generated from a curriculum. */

export function useSchemes(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.schemes(schoolId, query),
    queryFn: () => CurriculumEndpoints.fetchSchemes(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useScheme(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.scheme(schoolId, id ?? ''),
    queryFn: () => CurriculumEndpoints.fetchScheme(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Generates a *draft* scheme from the curriculum and the term's real teaching
 * weeks. It is explicitly a starting point — the teacher reorders and edits it
 * before submitting, and nothing about the generated plan is fixed (spec §14).
 */
export function useGenerateScheme() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateSchemeInput) => CurriculumEndpoints.generateScheme(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.schemes(schoolId) });
      toast.success('Draft scheme generated', {
        description: 'Review and adjust it before submitting for approval.',
      });
    },
  });
}

export function useSaveScheme(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<SchemeOfWork>; version: number }) =>
      CurriculumEndpoints.updateScheme(id, values, version),
    onSuccess: (scheme) => {
      queryClient.setQueryData(queryKeys.curriculum.scheme(schoolId, id), scheme);
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.schemes(schoolId) });
      toast.success(scheme.status === 'APPROVED' ? 'Scheme approved' : 'Scheme of work saved');
    },
  });
}
