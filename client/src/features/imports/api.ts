import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { ImportJobDetail } from '@/types/imports';
import { ImportEndpoints } from './imports.endpoints';
import type { ValidateImportInput, CommitImportInput } from './imports.endpoints';
import { activeImport, type ActiveImport } from './active-import';

export type { ValidateImportInput, CommitImportInput };

/** How often a running import is asked how far it has got. */
const PROGRESS_POLL_MS = 2000;

/** Dry run — returns problems, duplicates and a preview without writing. */
export function useValidateImport() {
  return useMutation({
    mutationFn: (input: ValidateImportInput) => ImportEndpoints.validate(input),
  });
}

/**
 * Starts an import.
 *
 * This resolves when the server has accepted the file, not when the rows are
 * in. The result is followed by {@link useActiveImport}, so nothing here can
 * report counts — and nothing may be invalidated yet either, since at this
 * point nothing has been written.
 */
export function useCommitImport() {
  return useMutation({
    mutationFn: (input: CommitImportInput) => ImportEndpoints.commit(input),
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

function isFinished(status: ImportJobDetail['status'] | undefined): boolean {
  return status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED';
}

/** Subscribes to whichever import this browser is watching, if any. */
export function useActiveImportRecord(): ActiveImport | null {
  const [record, setRecord] = useState(() => activeImport.get());
  useEffect(() => activeImport.subscribe(setRecord), []);
  return record;
}

/**
 * Follows the running import to completion.
 *
 * Only polls while there is one to follow, so a session that never started an
 * import never asks. Stops the moment the job reaches a terminal state — the
 * finished job stays in the cache so its counts and problems can still be read.
 */
export function useActiveImport() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();
  const record = useActiveImportRecord();
  const [announced, setAnnounced] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.imports.job(schoolId, record?.importId ?? 'none'),
    queryFn: () => ImportEndpoints.fetchJob(record!.importId),
    enabled: Boolean(schoolId && record && !record.dismissed),
    staleTime: 0,
    refetchInterval: (q) => (isFinished(q.state.data?.status) ? false : PROGRESS_POLL_MS),
  });

  const job = query.data;

  useEffect(() => {
    if (!job || !isFinished(job.status) || announced === job.id) return;
    setAnnounced(job.id);

    // Everything an import can touch is invalidated rather than patched: one
    // file may have created students, guardians, classes and links at once.
    // This happens now rather than when the import started, because until now
    // there was nothing new to fetch.
    void queryClient.invalidateQueries({ queryKey: ['school', schoolId ?? 'none'] });

    const description = `${job.created} created, ${job.updated} updated, ${job.skipped} skipped`;
    if (job.status === 'COMPLETED') toast.success('Import finished', { description });
    else if (job.status === 'PARTIAL') toast.warning('Import finished with problems', { description });
    else toast.error('Import failed', { description: 'Nothing was saved.' });
  }, [job, announced, queryClient, schoolId]);

  return {
    record,
    job: job ?? null,
    isRunning: Boolean(job && !isFinished(job.status)),
    percent:
      job && job.totalRows > 0
        ? Math.min(100, Math.round((job.processedRows / job.totalRows) * 100))
        : 0,
    dismiss: () => activeImport.clear(),
  };
}
