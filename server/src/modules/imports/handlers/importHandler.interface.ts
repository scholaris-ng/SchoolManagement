import type { EntityManager } from 'typeorm';
import type { RequestContext } from '../../../shared/types/context';
import type { ImportEntityName, ImportRowIssueRecord } from '../entities/importJob.entity';

/** A row after the caller's column mapping has been applied. Values are trimmed. */
export type MappedRow = Record<string, string>;

export interface RowCheck {
  issues: ImportRowIssueRecord[];
  /** The row as it would be saved — what the wizard shows under "first rows". */
  preview: Record<string, string>;
  /** The natural key already exists here, so committing this row is an update. */
  willUpdate: boolean;
}

export interface RowContext {
  context: RequestContext;
  rowNumber: number;
  row: MappedRow;
  /**
   * Present whenever the caller is inside a transaction. Reads must use it so
   * they see that transaction's own writes, and writes must use it so they are
   * rolled back with everything else.
   */
  manager?: EntityManager;
}

/**
 * One entity's import rules.
 *
 * The runner in `ImportsService` knows nothing about students or fee items — it
 * maps rows, tallies issues and manages the transaction, and calls through this
 * for everything entity-specific.
 */
export interface ImportEntityHandler {
  readonly entity: ImportEntityName;

  /** The field whose value identifies a record, e.g. `admissionNo`. */
  readonly naturalKeyField: string;
  /** How to name that field to a person: "admission number". */
  readonly naturalKeyLabel: string;

  /** The row's natural key, normalised for comparison, or null if it has none. */
  naturalKey(row: MappedRow): string | null;

  /** Reads only — never writes, so it is safe to call during a dry run. */
  check(params: RowContext): Promise<RowCheck>;

  /**
   * Writes one row. Must not open a transaction of its own: when `manager` is
   * given the write belongs to the caller's transaction.
   */
  apply(params: RowContext): Promise<'CREATED' | 'UPDATED'>;
}

export function issue(
  rowNumber: number,
  severity: 'ERROR' | 'WARNING',
  code: string,
  message: string,
  field?: string,
  value?: string,
): ImportRowIssueRecord {
  return { rowNumber, severity, code, message, field, value };
}
