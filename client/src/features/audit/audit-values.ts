import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import type { AuditReference } from '@/types/engagement';
import { describeField } from './audit-labels';

/**
 * Turns an entry's raw before/after payloads into lines a person can read.
 *
 * A payload is `{ classId: "dab3…", admissionNo: "A1S/2026/0046" }`. What comes
 * out is "Class — JSS 1 A", "Admission number — A1S/2026/0046": ids replaced by
 * the names the server resolved, codes and booleans and dates spoken plainly.
 */

/** One piece of a displayed value. A list of ids is several of these. */
export type AuditPart =
  | { kind: 'text'; text: string }
  | { kind: 'record'; id: string; type: string; label: string; removed: boolean }
  /** An id the server could not name: never in this school, or removed for good. */
  | { kind: 'unknown' };

export interface AuditRow {
  label: string;
  before: AuditPart[] | null;
  after: AuditPart[] | null;
  /** Both sides were recorded and they differ. */
  changed: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Keys that hold naira — but only on a finance record; see `carriesMoney`. */
const MONEY_KEYS = new Set(['amount', 'total', 'subtotal', 'balance', 'broughtForward', 'discountTotal']);

/**
 * Keys whose values are fixed words like `BANK_TRANSFER`. Listed rather than
 * guessed from the shape: a class code like `JSS1` is also all capitals, and
 * turning it into "Jss1" would be wrong.
 */
const ENUM_KEYS = new Set([
  'status',
  'state',
  'method',
  'provider',
  'mode',
  'type',
  'category',
  'day',
  'applicantType',
]);

/** Deep enough for a settings snapshot; anything below that is summarised. */
const MAX_DEPTH = 3;

const text = (value: string): AuditPart => ({ kind: 'text', text: value });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function partOf(
  key: string,
  value: unknown,
  references: Record<string, AuditReference>,
  money: boolean,
): AuditPart {
  if (isEmpty(value)) return text('—');
  if (typeof value === 'boolean') return text(value ? 'Yes' : 'No');
  // Only money gets digit grouping: a plain number might be a year or a score.
  if (typeof value === 'number') {
    return text(money && MONEY_KEYS.has(key) ? formatCurrency(value) : String(value));
  }
  if (typeof value === 'string') {
    if (UUID.test(value)) {
      const record = references[value];
      return record
        ? { kind: 'record', id: value, type: record.type, label: record.label, removed: record.removed }
        : { kind: 'unknown' };
    }
    if (DATE_TIME.test(value)) return text(formatDateTime(value));
    if (DATE.test(value)) return text(formatDate(value));
    if (ENUM_KEYS.has(key)) return text(humanizeEnum(value));
    return text(value);
  }
  // An object nested past the depth limit has no short spoken form.
  return text('Details recorded');
}

/** A value as one or more parts. An empty list reads "None", not nothing. */
export function partsOf(
  key: string,
  value: unknown,
  references: Record<string, AuditReference> = {},
  money = false,
): AuditPart[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [text('None')];
    // A list of objects — invoice lines, say — is a count, not the same phrase repeated.
    if (value.some((item) => typeof item === 'object' && item !== null)) {
      return [text(`${value.length} ${value.length === 1 ? 'item' : 'items'}`)];
    }
    return value.map((item) => partOf(key, item, references, money));
  }
  return [partOf(key, value, references, money)];
}

/** `{ a: { b: 1 } }` → `[['a', 'b'], 1]`, so nested settings read as one flat list. */
function flatten(
  value: Record<string, unknown> | null | undefined,
  path: string[] = [],
  out: Map<string, { path: string[]; value: unknown }> = new Map(),
): Map<string, { path: string[]; value: unknown }> {
  for (const [key, child] of Object.entries(value ?? {})) {
    const next = [...path, key];
    if (isPlainObject(child) && next.length < MAX_DEPTH) flatten(child, next, out);
    else out.set(next.join('.'), { path: next, value: child });
  }
  return out;
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The lines to show for an entry.
 *
 * With both sides recorded, rows that differ are marked `changed` and the rest
 * are kept as context. Rows that are empty on every side are dropped — an
 * `note: null` on a new record says nothing.
 */
export function buildRows(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  { references = {}, money = false }: { references?: Record<string, AuditReference>; money?: boolean } = {},
): AuditRow[] {
  const beforeFlat = flatten(before);
  const afterFlat = flatten(after);
  const keys = [...new Set([...afterFlat.keys(), ...beforeFlat.keys()])];
  const hasBoth = Boolean(before) && Boolean(after);

  return keys.flatMap((key) => {
    const b = beforeFlat.get(key);
    const a = afterFlat.get(key);
    if (isEmpty(b?.value) && isEmpty(a?.value)) return [];

    const path = (a ?? b)!.path;
    const leaf = path[path.length - 1];
    // "Branding › Primary colour": the parents say which group a setting sits in.
    const label = [...path.slice(0, -1).map(describeField), describeField(leaf)].join(' › ');

    return [
      {
        label,
        before: before ? partsOf(leaf, b?.value ?? null, references, money) : null,
        after: after ? partsOf(leaf, a?.value ?? null, references, money) : null,
        changed: hasBoth && !sameValue(b?.value, a?.value),
      },
    ];
  });
}

/** A part as plain text, for the export and anywhere a link is not possible. */
export function plainText(parts: AuditPart[] | null): string {
  if (!parts) return '';
  return parts
    .map((part) => {
      if (part.kind === 'text') return part.text;
      if (part.kind === 'unknown') return 'No longer available';
      return part.removed ? `${part.label} (deleted)` : part.label;
    })
    .join(', ');
}

/** "Class: JSS 1 → JSS 2; Status: Active" — one line for a spreadsheet cell. */
export function summarise(rows: AuditRow[]): string {
  return rows
    .map((row) =>
      row.changed
        ? `${row.label}: ${plainText(row.before)} → ${plainText(row.after)}`
        : `${row.label}: ${plainText(row.after ?? row.before)}`,
    )
    .join('; ');
}

/** Where a record of this type can be opened, if the app has a page for it. */
export function routeForRecord(type: string, id: string): string | null {
  switch (type) {
    case 'Student':
      return `/students/${id}`;
    case 'AdmissionApplication':
      return `/admissions/${id}`;
    case 'Guardian':
      return `/guardians/${id}`;
    case 'Staff':
      return `/staff/${id}`;
    case 'Invoice':
      return `/finance/invoices/${id}`;
    case 'Payment':
      return `/finance/receipts/${id}`;
    case 'Curriculum':
      return `/curriculum/${id}`;
    default:
      return null;
  }
}
