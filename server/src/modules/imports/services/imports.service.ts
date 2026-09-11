import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AppError } from '../../../shared/errors/AppError';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import type {
  ImportEntityName,
  ImportJob,
  ImportRowIssueRecord,
} from '../entities/importJob.entity';
import { ImportJobRepository } from '../repositories/importJob.repository';
import { IMPORT_HANDLERS, runsInSharedTransaction } from '../handlers';
import type { ImportEntityHandler, MappedRow } from '../handlers/importHandler.interface';
import { issue } from '../handlers/importHandler.interface';
import { REQUIRED_TARGETS, TARGET_LABELS } from '../validators/importTargets';
import type { CommitImportInput, ValidateImportInput } from '../validators/imports.schema';
import type {
  ImportAcceptedDTO,
  ImportJobDTO,
  ImportJobDetailDTO,
  ImportPreviewDTO,
  ImportResultDTO,
} from '../dto/imports.dto';

/** How many rows the wizard shows under "first rows, as they will be saved". */
const PREVIEW_ROWS = 20;

/** Progress is written at most this often, and at most every this many rows. */
const PROGRESS_EVERY_ROWS = 25;
const PROGRESS_EVERY_MS = 1000;

/** Imports running in this process, so shutdown can say so rather than leave them hanging. */
const running = new Set<string>();

/**
 * Reports how far an import has got, on a connection of its own.
 *
 * The four database-backed entities commit the whole file in one transaction,
 * and a write made through that transaction is invisible to everyone else
 * until it commits — which is the moment progress stops being interesting. So
 * this deliberately goes around it. Throttled, because a write per row would
 * cost more than the import.
 */
class ProgressReporter {
  private lastWriteAt = 0;
  private lastWritten = -1;

  constructor(private readonly jobId: string) {}

  async report(processedRows: number, force = false): Promise<void> {
    const now = Date.now();
    const dueByRows = processedRows - this.lastWritten >= PROGRESS_EVERY_ROWS;
    const dueByTime = now - this.lastWriteAt >= PROGRESS_EVERY_MS;
    if (!force && !dueByRows && !dueByTime) return;

    this.lastWriteAt = now;
    this.lastWritten = processedRows;
    try {
      await AppDataSource.query(
        `UPDATE import_jobs SET processed_rows = $1, updated_at = now() WHERE id = $2`,
        [processedRows, this.jobId],
      );
    } catch (error) {
      // Losing a progress tick must never cost the import itself.
      console.error(`[import] ${this.jobId} progress write failed:`, error);
    }
  }
}

/**
 * Marks whatever is still running as failed, for a server on its way down.
 *
 * `server.close()` waits only for HTTP connections, so a detached import is
 * killed regardless — saying so beats leaving a job reading "62%" forever.
 */
export async function failRunningImports(): Promise<void> {
  const ids = [...running];
  if (ids.length === 0) return;
  running.clear();
  try {
    await AppDataSource.query(
      `UPDATE import_jobs
          SET status = 'FAILED', completed_at = now(), updated_at = now()
        WHERE id = ANY($1::uuid[]) AND status = 'IMPORTING'`,
      [ids],
    );
  } catch (error) {
    console.error('[import] could not mark running imports as failed:', error);
  }
}

/**
 * Clears out imports a previous process was killed part way through.
 *
 * Runs at startup, before the server accepts traffic. Without it a job the
 * process never finished stays `IMPORTING` and its progress bar never moves.
 */
export async function reapAbandonedImports(): Promise<number> {
  const result = await AppDataSource.query(
    `UPDATE import_jobs
        SET status = 'FAILED', completed_at = now(), updated_at = now()
      WHERE status = 'IMPORTING'
      RETURNING id`,
  );
  return Array.isArray(result) ? result.length : 0;
}

interface CheckedRow {
  rowNumber: number;
  row: MappedRow;
  issues: ImportRowIssueRecord[];
  preview: Record<string, string>;
  willUpdate: boolean;
  hasError: boolean;
}

/**
 * Runs a bulk import (spec section 9).
 *
 * Two calls, deliberately: `validate` writes nothing and answers with what
 * would happen, and `commit` then applies the file. Neither trusts the other's
 * conclusions — commit re-checks every row against the database as it is at
 * that moment, because a class can be renamed or an admission number taken
 * between the two.
 *
 * The runner itself knows nothing about students or fee items. Everything
 * entity-specific lives behind `ImportEntityHandler`.
 */
export class ImportsService {
  static Instance = new ImportsService();

  private constructor(
    private readonly jobs = ImportJobRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async validate(context: RequestContext, input: ValidateImportInput): Promise<ImportPreviewDTO> {
    const entity = input.entity as ImportEntityName;
    const handler = IMPORT_HANDLERS[entity];

    this.assertRequiredColumnsMapped(entity, input.mapping);

    const rows = input.rows.map((row, index) => ({
      rowNumber: index + 2, // row 1 is the heading the school sees in Excel
      row: mapRow(row, input.mapping),
    }));

    const lookups = await handler.prepare(context, rows.map((row) => row.row));
    const checked = await this.checkAll(context, handler, rows, lookups);
    const tally = tallyOf(checked);
    const issues = checked.flatMap((row) => row.issues);

    const job = await this.jobs.create({
      schoolId: context.schoolId,
      entity,
      fileName: input.fileName,
      mapping: input.mapping,
      rows: input.rows,
      status: 'VALIDATED',
      ...tally,
      issues,
      startedByUserId: context.user.id,
      startedByName: context.user.displayName,
    });

    return {
      importId: job.id,
      entity,
      ...tally,
      issues,
      preview: checked
        .filter((row) => !row.hasError)
        .slice(0, PREVIEW_ROWS)
        .map((row) => row.preview),
    };
  }

  /**
   * Accepts the import and starts it, rather than doing it.
   *
   * A file of any size used to run inside the request, and the browser gives
   * up on a request after thirty seconds — so a large import reported itself
   * as a network failure while the rows were quietly landing. The work now
   * outlives the request and the client follows `GET /imports/:id`.
   */
  async commit(context: RequestContext, input: CommitImportInput): Promise<ImportAcceptedDTO> {
    const job = await this.jobs.findByIdScoped(context.schoolId, input.importId);
    if (!job) throw AppError.notFound('Import');

    if (!(await this.jobs.claimForImport(context.schoolId, job.id))) {
      throw AppError.conflict('This import has already been run.');
    }

    void this.runInBackground(context, job, input.skipInvalidRows);

    return {
      importId: job.id,
      entity: job.entity,
      status: 'IMPORTING',
      totalRows: job.totalRows,
    };
  }

  /**
   * The detached run.
   *
   * Nothing may escape from here: an unhandled rejection reaches
   * `process.on('uncaughtException')` in `server.ts`, which shuts the server
   * down. Whatever happens, the job stops looking like it is still running.
   */
  private async runInBackground(
    context: RequestContext,
    job: ImportJob,
    skipInvalidRows: boolean,
  ): Promise<void> {
    running.add(job.id);
    try {
      const outcome = runsInSharedTransaction(job.entity)
        ? await this.commitInTransaction(context, job, skipInvalidRows)
        : await this.commitRowByRow(context, job, skipInvalidRows);
      await this.finish(context, job, outcome);
    } catch (error) {
      console.error(`[import] ${job.id} failed:`, error);
      await this.jobs
        .update(job.id, {
          status: 'FAILED',
          completedAt: new Date(),
          issues: [
            ...job.issues,
            issue(0, 'ERROR', 'IMPORT_FAILED', 'The import stopped before it finished. Nothing was saved.'),
          ],
        })
        .catch((updateError) => console.error(`[import] ${job.id} could not be marked failed:`, updateError));
    } finally {
      running.delete(job.id);
    }
  }

  async fetchJob(context: RequestContext, id: string): Promise<ImportJobDetailDTO> {
    const job = await this.jobs.findByIdScoped(context.schoolId, id);
    if (!job) throw AppError.notFound('Import');

    return {
      id: job.id,
      schoolId: job.schoolId,
      entity: job.entity,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      created: job.created,
      updated: job.updated,
      skipped: job.skipped,
      failed: job.failed,
      issues: job.issues,
      startedByName: job.startedByName,
      startedAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  async fetchJobs(
    context: RequestContext,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ImportJobDTO>> {
    return this.jobs.fetchPaginated(context.schoolId, page, pageSize);
  }

  // ─── Committing ────────────────────────────────────────────────────────────

  /**
   * Students, guardians, subjects and fee items: the whole file in one
   * transaction.
   *
   * When bad rows are being skipped each write goes inside a SAVEPOINT, because
   * PostgreSQL abandons a transaction after any failed statement — without one,
   * a single unexpected failure would take every row after it down too. When
   * they are not being skipped there is no savepoint at all: anything wrong
   * unwinds the entire file, which is the promise the wizard makes.
   */
  private async commitInTransaction(
    context: RequestContext,
    job: ImportJob,
    skipInvalidRows: boolean,
  ): Promise<Outcome> {
    const handler = IMPORT_HANDLERS[job.entity];
    const rows = this.mappedRows(job);
    const outcome = emptyOutcome();
    const progress = new ProgressReporter(job.id);

    await AppDataSource.transaction(async (manager) => {
      const lookups = await handler.prepare(context, rows.map((row) => row.row), manager);
      const checked = await this.checkAll(context, handler, rows, lookups, manager);

      if (!skipInvalidRows && checked.some((row) => row.hasError)) {
        outcome.issues = checked.flatMap((row) => row.issues);
        throw new AbortImport();
      }

      let processed = 0;
      for (const row of checked) {
        outcome.issues.push(...row.issues);

        if (row.hasError) {
          outcome.skipped += 1;
        } else {
          try {
            const params = { context, rowNumber: row.rowNumber, row: row.row, lookups };
            const applied = skipInvalidRows
              ? await manager.transaction((savepoint) => handler.apply({ ...params, manager: savepoint }))
              : await handler.apply({ ...params, manager });
            countApplied(outcome, applied);
          } catch (error) {
            if (!skipInvalidRows) throw error;
            outcome.failed += 1;
            outcome.issues.push(failureIssue(row.rowNumber, error, handler, row.row));
          }
        }

        processed += 1;
        outcome.processed = processed;
        await progress.report(processed);
      }
    }).catch((error) => {
      if (error instanceof AbortImport) {
        outcome.aborted = true;
        return;
      }
      throw error;
    });

    return outcome;
  }

  /**
   * Staff: one row at a time, with no shared transaction.
   *
   * Hiring someone creates a login with an external identity provider, which no
   * database rollback can undo. So every row is checked first and nobody is
   * provisioned at all if the file has errors and they are not being skipped —
   * that reaches "nothing was saved" for the case that actually happens, bad
   * data. A row that passes that check and then fails anyway is recorded and
   * the run continues, because stopping would strand the people already hired.
   */
  private async commitRowByRow(
    context: RequestContext,
    job: ImportJob,
    skipInvalidRows: boolean,
  ): Promise<Outcome> {
    const handler = IMPORT_HANDLERS[job.entity];
    const rows = this.mappedRows(job);
    const outcome = emptyOutcome();
    const progress = new ProgressReporter(job.id);

    const lookups = await handler.prepare(context, rows.map((row) => row.row));
    const checked = await this.checkAll(context, handler, rows, lookups);
    outcome.issues = checked.flatMap((row) => row.issues);

    if (!skipInvalidRows && checked.some((row) => row.hasError)) {
      outcome.aborted = true;
      return outcome;
    }

    let processed = 0;
    for (const row of checked) {
      if (row.hasError) {
        outcome.skipped += 1;
      } else {
        try {
          countApplied(
            outcome,
            await handler.apply({ context, rowNumber: row.rowNumber, row: row.row, lookups }),
          );
        } catch (error) {
          outcome.failed += 1;
          outcome.issues.push(failureIssue(row.rowNumber, error, handler, row.row));
        }
      }

      processed += 1;
      outcome.processed = processed;
      await progress.report(processed);
    }

    return outcome;
  }

  private async finish(
    context: RequestContext,
    job: ImportJob,
    outcome: Outcome,
  ): Promise<ImportResultDTO> {
    const wroteNothing = outcome.created === 0 && outcome.updated === 0;
    const status: ImportResultDTO['status'] = outcome.aborted
      ? 'FAILED'
      : wroteNothing && (outcome.failed > 0 || outcome.skipped > 0)
        ? 'FAILED'
        : outcome.failed > 0 || outcome.skipped > 0
          ? 'PARTIAL'
          : 'COMPLETED';

    const completedAt = new Date();
    await this.jobs.update(job.id, {
      status,
      // Written exactly rather than left on whatever the last throttled tick
      // happened to say, so a finished import never rests at 99%.
      processedRows: outcome.processed,
      created: outcome.created,
      updated: outcome.updated,
      skipped: outcome.skipped,
      failed: outcome.failed,
      issues: outcome.issues,
      completedAt,
    });

    await this.audit.record(context, {
      action: 'import.committed',
      entityType: 'ImportJob',
      entityId: job.id,
      entityLabel: `${job.entity} import (${job.fileName})`,
      after: {
        status,
        created: outcome.created,
        updated: outcome.updated,
        skipped: outcome.skipped,
        failed: outcome.failed,
      },
    });

    return {
      importId: job.id,
      entity: job.entity,
      status,
      created: outcome.created,
      updated: outcome.updated,
      skipped: outcome.skipped,
      failed: outcome.failed,
      issues: outcome.issues,
      errorReportUrl: null,
      completedAt: completedAt.toISOString(),
    };
  }

  // ─── Checking ──────────────────────────────────────────────────────────────

  /**
   * Runs every row through the handler and adds the one check the handler
   * cannot make on its own: whether the file repeats a key it already used.
   */
  private async checkAll(
    context: RequestContext,
    handler: ImportEntityHandler,
    rows: { rowNumber: number; row: MappedRow }[],
    lookups: unknown,
    manager?: EntityManager,
  ): Promise<CheckedRow[]> {
    const seen = new Map<string, number>();
    const seenAlso = new Map<string, Map<string, number>>();
    const checked: CheckedRow[] = [];

    for (const { rowNumber, row } of rows) {
      const result = await handler.check({ context, rowNumber, row, lookups, manager });
      const issues = [...result.issues];

      const key = handler.naturalKey(row)?.toLowerCase() ?? null;
      if (key) {
        const first = seen.get(key);
        if (first !== undefined) {
          issues.push(
            issue(
              rowNumber,
              'ERROR',
              'DUPLICATE_IN_FILE',
              `This ${handler.naturalKeyLabel} is already used on row ${first} of this file.`,
              handler.naturalKeyField,
              handler.naturalKey(row) ?? undefined,
            ),
          );
        } else {
          seen.set(key, rowNumber);
        }
      }

      for (const unique of handler.alsoUniqueInFile ?? []) {
        const value = (row[unique.field] ?? '').trim().toLowerCase();
        if (!value) continue;

        const bucket = seenAlso.get(unique.field) ?? new Map<string, number>();
        seenAlso.set(unique.field, bucket);

        const first = bucket.get(value);
        if (first !== undefined) {
          issues.push(
            issue(
              rowNumber,
              'ERROR',
              'DUPLICATE_IN_FILE',
              `This ${unique.label} is already used on row ${first} of this file. Each one can only belong to a single person.`,
              unique.field,
              row[unique.field],
            ),
          );
        } else {
          bucket.set(value, rowNumber);
        }
      }

      checked.push({
        rowNumber,
        row,
        issues,
        // The wizard draws one preview cell per mapped column, so a column the
        // handler does not speak for would read as blank — as though the file
        // were missing data it plainly has. Starting from the mapped row means
        // every column shows something; the handler's normalised values win
        // wherever it has an opinion.
        preview: { ...row, ...result.preview },
        willUpdate: result.willUpdate,
        hasError: issues.some((entry) => entry.severity === 'ERROR'),
      });
    }

    return checked;
  }

  private mappedRows(job: ImportJob): { rowNumber: number; row: MappedRow }[] {
    return job.rows.map((row, index) => ({
      rowNumber: index + 2,
      row: mapRow(row, job.mapping),
    }));
  }

  /**
   * The browser blocks this already, but the mapping arrives from the client
   * and a missing required column would otherwise surface as every row failing
   * for a reason nobody can act on.
   */
  private assertRequiredColumnsMapped(
    entity: ImportEntityName,
    mapping: Record<string, string | null>,
  ): void {
    const missing = REQUIRED_TARGETS[entity].filter((key) => !mapping[key]);
    if (missing.length > 0) {
      const names = missing.map((key) => TARGET_LABELS[key] ?? key).join(', ');
      throw AppError.validation(`These columns still need to be matched: ${names}.`);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Outcome {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Rows dealt with, so the finished job does not rest on a throttled tick. */
  processed: number;
  issues: ImportRowIssueRecord[];
  /** Nothing was written on purpose, because the file had errors. */
  aborted: boolean;
}

/** Unwinds the transaction without being mistaken for an unexpected failure. */
class AbortImport extends Error {}

function emptyOutcome(): Outcome {
  return { created: 0, updated: 0, skipped: 0, failed: 0, processed: 0, issues: [], aborted: false };
}

function countApplied(outcome: Outcome, applied: 'CREATED' | 'UPDATED'): void {
  if (applied === 'CREATED') outcome.created += 1;
  else outcome.updated += 1;
}

/**
 * A row that failed while being written.
 *
 * Carries whatever identifies the record — the staff number, the admission
 * number — because an error report that only says "row 2" and repeats a
 * message leaves a school hunting through the spreadsheet for which person it
 * meant.
 */
function failureIssue(
  rowNumber: number,
  error: unknown,
  handler: ImportEntityHandler,
  row: MappedRow,
): ImportRowIssueRecord {
  const message = error instanceof AppError ? error.message : 'This row could not be saved.';
  return issue(
    rowNumber,
    'ERROR',
    'WRITE_FAILED',
    message,
    handler.naturalKeyField,
    handler.naturalKey(row) ?? undefined,
  );
}

function tallyOf(checked: CheckedRow[]) {
  return {
    totalRows: checked.length,
    validRows: checked.filter((row) => !row.hasError).length,
    errorRows: checked.filter((row) => row.hasError).length,
    warningRows: checked.filter((row) => row.issues.some((entry) => entry.severity === 'WARNING'))
      .length,
    // A row matching an existing record is still valid — it updates rather than
    // creates. The count is here so a school can see it coming.
    duplicateRows: checked.filter((row) => row.willUpdate && !row.hasError).length,
  };
}

/** Turns one uploaded row into target keys, using the mapping the caller chose. */
export function mapRow(
  source: Record<string, string>,
  mapping: Record<string, string | null>,
): MappedRow {
  const mapped: MappedRow = {};
  for (const [targetKey, header] of Object.entries(mapping)) {
    if (!header) continue;
    mapped[targetKey] = (source[header] ?? '').trim();
  }
  return mapped;
}
