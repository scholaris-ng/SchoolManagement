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
import type { ImportJobDTO, ImportPreviewDTO, ImportResultDTO } from '../dto/imports.dto';

/** How many rows the wizard shows under "first rows, as they will be saved". */
const PREVIEW_ROWS = 20;

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

    const checked = await this.checkAll(context, handler, rows);
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

  async commit(context: RequestContext, input: CommitImportInput): Promise<ImportResultDTO> {
    const job = await this.jobs.findByIdScoped(context.schoolId, input.importId);
    if (!job) throw AppError.notFound('Import');

    if (!(await this.jobs.claimForImport(context.schoolId, job.id))) {
      throw AppError.conflict('This import has already been run.');
    }

    try {
      const outcome = runsInSharedTransaction(job.entity)
        ? await this.commitInTransaction(context, job, input.skipInvalidRows)
        : await this.commitRowByRow(context, job, input.skipInvalidRows);
      return await this.finish(context, job, outcome);
    } catch (error) {
      await this.jobs.update(job.id, { status: 'FAILED', completedAt: new Date() });
      throw error;
    }
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

    await AppDataSource.transaction(async (manager) => {
      const checked = await this.checkAll(context, handler, rows, manager);

      if (!skipInvalidRows && checked.some((row) => row.hasError)) {
        outcome.issues = checked.flatMap((row) => row.issues);
        throw new AbortImport();
      }

      for (const row of checked) {
        outcome.issues.push(...row.issues);

        if (row.hasError) {
          outcome.skipped += 1;
          continue;
        }

        try {
          const applied = skipInvalidRows
            ? await manager.transaction((savepoint) =>
                handler.apply({ context, rowNumber: row.rowNumber, row: row.row, manager: savepoint }),
              )
            : await handler.apply({ context, rowNumber: row.rowNumber, row: row.row, manager });
          countApplied(outcome, applied);
        } catch (error) {
          if (!skipInvalidRows) throw error;
          outcome.failed += 1;
          outcome.issues.push(failureIssue(row.rowNumber, error));
        }
      }
    }).catch((error) => {
      if (error instanceof AbortImport) {
        outcome.aborted = true;
        return;
      }
      throw error;
    });

    if (outcome.aborted) return outcome;
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

    const checked = await this.checkAll(context, handler, rows);
    outcome.issues = checked.flatMap((row) => row.issues);

    if (!skipInvalidRows && checked.some((row) => row.hasError)) {
      outcome.aborted = true;
      return outcome;
    }

    for (const row of checked) {
      if (row.hasError) {
        outcome.skipped += 1;
        continue;
      }
      try {
        countApplied(outcome, await handler.apply({ context, rowNumber: row.rowNumber, row: row.row }));
      } catch (error) {
        outcome.failed += 1;
        outcome.issues.push(failureIssue(row.rowNumber, error));
      }
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
    manager?: EntityManager,
  ): Promise<CheckedRow[]> {
    const seen = new Map<string, number>();
    const checked: CheckedRow[] = [];

    for (const { rowNumber, row } of rows) {
      const result = await handler.check({ context, rowNumber, row, manager });
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

      checked.push({
        rowNumber,
        row,
        issues,
        preview: result.preview,
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
  issues: ImportRowIssueRecord[];
  /** Nothing was written on purpose, because the file had errors. */
  aborted: boolean;
}

/** Unwinds the transaction without being mistaken for an unexpected failure. */
class AbortImport extends Error {}

function emptyOutcome(): Outcome {
  return { created: 0, updated: 0, skipped: 0, failed: 0, issues: [], aborted: false };
}

function countApplied(outcome: Outcome, applied: 'CREATED' | 'UPDATED'): void {
  if (applied === 'CREATED') outcome.created += 1;
  else outcome.updated += 1;
}

function failureIssue(rowNumber: number, error: unknown): ImportRowIssueRecord {
  const message = error instanceof AppError ? error.message : 'This row could not be saved.';
  return issue(rowNumber, 'ERROR', 'WRITE_FAILED', message);
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
