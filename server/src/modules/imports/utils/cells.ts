/**
 * Reading what a school actually typed into a spreadsheet cell.
 *
 * Deliberately forgiving about case and stray spaces, and deliberately strict
 * about dates: a cell reading "12/05/2014" is ambiguous in a way no amount of
 * guessing fixes, so it is reported rather than interpreted. Excel's real date
 * cells are already converted to ISO in the browser (`client/src/lib/xlsx-import.ts`).
 */

const TRUTHY = new Set(['TRUE', 'YES', 'Y', '1']);
const FALSY = new Set(['FALSE', 'NO', 'N', '0']);

export interface BooleanCell {
  value: boolean;
  /** Set when the cell held something that could not be read as yes or no. */
  warning?: string;
}

export function parseBooleanCell(raw: string | undefined, fallback: boolean): BooleanCell {
  const text = (raw ?? '').trim().toUpperCase();
  if (text === '') return { value: fallback };
  if (TRUTHY.has(text)) return { value: true };
  if (FALSY.has(text)) return { value: false };
  return {
    value: fallback,
    warning: `Could not read "${raw}" as yes or no, so ${fallback ? 'yes' : 'no'} was used.`,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Rejects 2025-02-30, which Date would roll forward into March.
  return parsed.toISOString().slice(0, 10) === value;
}

/** Splits a multi-value cell such as `TEACHER;FORM_TEACHER`, dropping blanks. */
export function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Trim and collapse internal runs of whitespace, for comparing typed names. */
export function normaliseSpacing(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Splits a single free-text name into first and last.
 *
 * The student import offers one "Guardian name" column but a guardian record
 * needs both halves. Splitting at the last space is the least-bad rule: it gets
 * "Ngozi Eze" right, and puts any title or middle name into the first name
 * rather than mangling the surname, which is the half that has to be right.
 */
export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const cleaned = normaliseSpacing(full);
  const cut = cleaned.lastIndexOf(' ');
  if (cut === -1) return { firstName: cleaned, lastName: cleaned };
  return { firstName: cleaned.slice(0, cut), lastName: cleaned.slice(cut + 1) };
}
