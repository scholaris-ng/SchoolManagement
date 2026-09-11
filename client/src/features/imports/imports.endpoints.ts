import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  ImportAccepted,
  ImportEntity,
  ImportJob,
  ImportJobDetail,
  ImportMapping,
  ImportPreview,
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
 * Endpoint layer for bulk import — deliberately two calls.
 *
 * `validate` writes nothing: it returns the problems, the duplicates and a
 * preview so a school can see exactly what would happen. `commit` then applies
 * the whole file in one server transaction, so a failure half way through
 * leaves the register untouched rather than partly overwritten (spec §9).
 *
 * `commit` returns as soon as the work has been accepted rather than when it
 * has finished — a long import used to outlast the request and report itself
 * as a network failure while the rows were landing. `fetchJob` is how its
 * progress, and then its result, are followed.
 */
export const ImportEndpoints = {
  validate: (input: ValidateImportInput) => http.post<ImportPreview>('/imports/validate', input),

  commit: (input: CommitImportInput) => http.post<ImportAccepted>('/imports/commit', input),

  fetchJob: (id: string) => http.get<ImportJobDetail>(`/imports/${id}`),

  fetchJobs: (query: ListQuery) => http.get<Paginated<ImportJob>>('/imports', { query }),
};
