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

export interface RowContext<L = unknown> {
  context: RequestContext;
  rowNumber: number;
  row: MappedRow;
  /** Everything `prepare` looked up for this run. */
  lookups: L;
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
export interface ImportEntityHandler<L = unknown> {
  readonly entity: ImportEntityName;

  /** The field whose value identifies a record, e.g. `admissionNo`. */
  readonly naturalKeyField: string;
  /** How to name that field to a person: "admission number". */
  readonly naturalKeyLabel: string;

  /** The row's natural key, normalised for comparison, or null if it has none. */
  naturalKey(row: MappedRow): string | null;

  /**
   * Fields beyond the natural key that two rows of one file must not share.
   *
   * Staff have one: the staff number says which record a row is, but the email
   * is a sign-in credential, and two people cannot have the same one. Without
   * this the second row passes every check — the address is not taken *yet* —
   * and then fails when the first row has just claimed it.
   */
  readonly alsoUniqueInFile?: { field: string; label: string }[];

  /**
   * Loads everything the whole file will need, once.
   *
   * A query per row is what made importing a few hundred rows take a minute
   * against a database on the other side of a slow link. Classes, levels and
   * the records a file might already be updating are all read up front and
   * matched in memory instead.
   */
  prepare(
    context: RequestContext,
    rows: MappedRow[],
    manager?: EntityManager,
  ): Promise<L>;

  /** Reads only — never writes, so it is safe to call during a dry run. */
  check(params: RowContext<L>): Promise<RowCheck>;

  /**
   * Writes one row. Must not open a transaction of its own: when `manager` is
   * given the write belongs to the caller's transaction.
   */
  apply(params: RowContext<L>): Promise<'CREATED' | 'UPDATED'>;
}

/** Trim, collapse inner runs of whitespace and lower-case, for matching typed names. */
export function matchKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
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
