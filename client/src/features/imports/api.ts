import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  ImportEntity,
  ImportJob,
  ImportMapping,
  ImportPreview,
  ImportResult,
} from '@/types/imports';

export interface ValidateImportInput {
  entity: ImportEntity;
  fileName: string;
  mapping: ImportMapping;
  rows: Record<string, string>[];
}

export interface CommitImportInput {
  importId: string;
  /** Import only the rows that passed validation, instead of refusing the file. */
  skipInvalidRows: boolean;
}

/**
 * Bulk import is deliberately two calls.
 *
 * `validate` writes nothing: it returns the problems, the duplicates and a
 * preview so a school can see exactly what would happen. `commit` then applies
 * the whole file in one server transaction, so a failure half way through
 * leaves the register untouched rather than partly overwritten (spec §9).
 */
export function useValidateImport() {
  return useMutation({
    mutationFn: (input: ValidateImportInput) => http.post<ImportPreview>('/imports/validate', input),
  });
}

export function useCommitImport() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommitImportInput) => http.post<ImportResult>('/imports/commit', input),
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
    queryFn: () => http.get<Paginated<ImportJob>>('/imports', { query }),
    enabled: Boolean(schoolId),
  });
}
