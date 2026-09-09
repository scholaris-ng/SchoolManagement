import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { ImportEndpoints } from './imports.endpoints';
import type { ValidateImportInput, CommitImportInput } from './imports.endpoints';

export type { ValidateImportInput, CommitImportInput };

/** Dry run — returns problems, duplicates and a preview without writing. */
export function useValidateImport() {
  return useMutation({
    mutationFn: (input: ValidateImportInput) => ImportEndpoints.validate(input),
  });
}

export function useCommitImport() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommitImportInput) => ImportEndpoints.commit(input),
    onSuccess: (result) => {
      // Everything an import can touch is invalidated rather than patched: the
      // file may have created students, guardians, classes and links at once.
      void queryClient.invalidateQueries({ queryKey: ['school', schoolId ?? 'none'] });
      const description = `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`;
      if (result.status === 'COMPLETED') toast.success('Import finished', { description });
      else if (result.status === 'PARTIAL') toast.warning('Import finished with problems', { description });
      else toast.error('Import failed', { description });
    },
  });
}

export function useImportJobs(query: ListQuery = { page: 1, pageSize: 10 }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.imports.jobs(schoolId, query),
    queryFn: () => ImportEndpoints.fetchJobs(query),
    enabled: Boolean(schoolId),
  });
}
