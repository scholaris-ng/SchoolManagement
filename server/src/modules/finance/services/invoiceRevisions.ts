/**
 * Invoice versions — what an invoice said after each edit, and what changed.
 *
 * An issued invoice is a document a family may already be holding, so a
 * correction must not silently rewrite it. Every tracked edit stores the whole
 * invoice as it stood afterwards (`InvoiceSnapshot`) plus a plain list of what
 * moved (`InvoiceChange`), so the office can answer "what did the first copy
 * say, and who changed it?" without reconstructing it from an audit trail.
 *
 * All of this is pure: no database, no clock. The service builds the snapshots
 * and persists them; this file only describes and compares them.
 */

/** Money is compared in kobo so float noise never reads as a change. */
const MONEY_SCALE = 100;
const kobo = (amount: number): number => Math.round(amount * MONEY_SCALE);

/** One of the invoice's own charges, as it stood at a version. */
export interface RevisionLine {
  feeItemId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  discountAmount: number;
  lineTotal: number;
  isOptional: boolean;
}

/**
 * The invoice as one version saw it.
 *
 * Only the invoice's own charges are kept. Lines carried in from an earlier
 * invoice are the balance it took over, not something an edit can change, and
 * `broughtForward` already accounts for them.
 */
export interface InvoiceSnapshot {
  dueDate: string;
  note: string | null;
  lines: RevisionLine[];
  subtotal: number;
  discountTotal: number;
  appliedDiscounts: { name: string; amount: number }[];
  broughtForward: number;
  total: number;
}

export type InvoiceChangeKind =
  | 'LINE_ADDED'
  | 'LINE_REMOVED'
  | 'LINE_CHANGED'
  | 'DUE_DATE'
  | 'NOTE'
  | 'DISCOUNT'
  /** What was carried in from an earlier invoice moved — because that invoice was edited. */
  | 'BROUGHT_FORWARD'
  | 'TOTAL';

/**
 * One thing that moved between two versions. `from`/`to` are money for the
 * line and total kinds and text for the date and note, so the client can format
 * each without guessing; `detail` is extra wording where the amount alone
 * would hide the change (a quantity going from 1 to 2 at the same price).
 */
export interface InvoiceChange {
  kind: InvoiceChangeKind;
  label: string | null;
  from: string | number | null;
  to: string | number | null;
  detail: string | null;
}

/** The slice of an invoice a snapshot is taken from — satisfied by `InvoiceDTO`. */
export interface SnapshotSource {
  dueDate: string | Date;
  note: string | null;
  subtotal: number;
  discountTotal: number;
  broughtForward: number;
  total: number;
  appliedDiscounts: { name: string; amount: number }[];
  lines: {
    feeItemId: string;
    description: string;
    quantity: number;
    unitAmount: number;
    discountAmount: number;
    lineTotal: number;
    isOptional: boolean;
    carriedFromInvoiceId: string | null;
  }[];
}

/** `2026-11-13`, whether the driver handed back a string or a `Date`. */
export function isoDay(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function snapshotOf(source: SnapshotSource): InvoiceSnapshot {
  return {
    dueDate: isoDay(source.dueDate),
    note: source.note ? source.note : null,
    lines: source.lines
      .filter((line) => !line.carriedFromInvoiceId)
      .map((line) => ({
        feeItemId: line.feeItemId,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        discountAmount: line.discountAmount,
        lineTotal: line.lineTotal,
        isOptional: line.isOptional,
      })),
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    appliedDiscounts: source.appliedDiscounts.map((entry) => ({
      name: entry.name,
      amount: entry.amount,
    })),
    broughtForward: source.broughtForward,
    total: source.total,
  };
}

/**
 * Pairs each line of `after` with the line of `before` it came from. A fee item
 * is matched in order of appearance, so an item that legitimately occurs twice
 * on one bill still pairs one-to-one rather than collapsing.
 */
function pairLines(
  before: RevisionLine[],
  after: RevisionLine[],
): {
  changed: { before: RevisionLine; after: RevisionLine }[];
  added: RevisionLine[];
  removed: RevisionLine[];
} {
  const unmatched = [...before];
  const changed: { before: RevisionLine; after: RevisionLine }[] = [];
  const added: RevisionLine[] = [];

  for (const line of after) {
    const at = unmatched.findIndex((candidate) => candidate.feeItemId === line.feeItemId);
    if (at === -1) {
      added.push(line);
    } else {
      changed.push({ before: unmatched[at], after: line });
      unmatched.splice(at, 1);
    }
  }

  return { changed, added, removed: unmatched };
}

function describeLineChange(before: RevisionLine, after: RevisionLine): string | null {
  const parts: string[] = [];
  if (before.quantity !== after.quantity) {
    parts.push(`Quantity ${before.quantity} → ${after.quantity}`);
  }
  if (kobo(before.unitAmount) !== kobo(after.unitAmount)) {
    parts.push('Price changed');
  }
  if (kobo(before.discountAmount) !== kobo(after.discountAmount)) {
    parts.push('Discount changed');
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** What moved from `before` to `after`, in the order a person reads an invoice. */
export function diffSnapshots(before: InvoiceSnapshot, after: InvoiceSnapshot): InvoiceChange[] {
  const changes: InvoiceChange[] = [];
  const { changed, added, removed } = pairLines(before.lines, after.lines);

  for (const line of removed) {
    changes.push({
      kind: 'LINE_REMOVED',
      label: line.description,
      from: line.lineTotal,
      to: null,
      detail: null,
    });
  }
  for (const line of added) {
    changes.push({
      kind: 'LINE_ADDED',
      label: line.description,
      from: null,
      to: line.lineTotal,
      detail: null,
    });
  }
  for (const pair of changed) {
    const detail = describeLineChange(pair.before, pair.after);
    const moved =
      kobo(pair.before.lineTotal) !== kobo(pair.after.lineTotal) ||
      pair.before.description !== pair.after.description ||
      detail !== null;
    if (!moved) continue;
    changes.push({
      kind: 'LINE_CHANGED',
      label: pair.after.description,
      from: pair.before.lineTotal,
      to: pair.after.lineTotal,
      detail,
    });
  }

  if (kobo(before.discountTotal) !== kobo(after.discountTotal)) {
    changes.push({
      kind: 'DISCOUNT',
      label: null,
      from: before.discountTotal,
      to: after.discountTotal,
      detail: null,
    });
  }
  if (kobo(before.broughtForward) !== kobo(after.broughtForward)) {
    changes.push({
      kind: 'BROUGHT_FORWARD',
      label: null,
      from: before.broughtForward,
      to: after.broughtForward,
      detail: null,
    });
  }
  if (before.dueDate !== after.dueDate) {
    changes.push({
      kind: 'DUE_DATE',
      label: null,
      from: before.dueDate,
      to: after.dueDate,
      detail: null,
    });
  }
  if ((before.note ?? '') !== (after.note ?? '')) {
    changes.push({ kind: 'NOTE', label: null, from: before.note, to: after.note, detail: null });
  }
  if (kobo(before.total) !== kobo(after.total)) {
    changes.push({
      kind: 'TOTAL',
      label: null,
      from: before.total,
      to: after.total,
      detail: null,
    });
  }

  return changes;
}

/**
 * Whether any of these changes touches what the family is billed — as opposed
 * to the due date or note, which a correction rarely needs explaining for. A
 * billing change must carry a reason; a reschedule need not.
 */
export function changesBilling(changes: InvoiceChange[]): boolean {
  return changes.some(
    (change) =>
      change.kind === 'LINE_ADDED' ||
      change.kind === 'LINE_REMOVED' ||
      change.kind === 'LINE_CHANGED' ||
      change.kind === 'DISCOUNT' ||
      change.kind === 'BROUGHT_FORWARD' ||
      change.kind === 'TOTAL',
  );
}

/** How much one of an earlier invoice's own charges moved, in kobo. */
export interface SourceLineDelta {
  feeItemId: string;
  deltaKobo: number;
}

/** A charge as the follow-up invoice carries it: the balance still owing on that fee item. */
export interface CarriedCopy {
  id: string;
  feeItemId: string;
  totalKobo: number;
  /** Already put towards this carried charge — itemised payments, or a receipt tick. */
  paidKobo: number;
}

/**
 * How the follow-up invoice's carried charges follow an edit to the invoice they
 * came from.
 *
 * A carried charge holds what was still owing on one fee item, so when that
 * item moves by some amount the carried one moves by the same amount: a charge
 * that went up by ₦10,000 owes ₦10,000 more, one that was removed owes nothing,
 * and an item that had been paid in full and is now billed higher starts to owe
 * the difference. Charges are matched by fee item, in order, as everywhere else.
 *
 * A carried charge may fall below what has been put towards it, or go to
 * nothing. The money does not disappear — it stays against the invoice — so the
 * caller is told which updates leave a charge under its payments (`belowPaid`)
 * and which charges go (`remove`), and releases what was itemised to them.
 */
export function planCarriedSync(
  copies: CarriedCopy[],
  deltas: SourceLineDelta[],
): {
  update: { id: string; totalKobo: number; belowPaid: boolean }[];
  remove: string[];
  insert: { feeItemId: string; totalKobo: number }[];
} {
  const free = [...copies];
  const update: { id: string; totalKobo: number; belowPaid: boolean }[] = [];
  const remove: string[] = [];
  const insert: { feeItemId: string; totalKobo: number }[] = [];

  for (const { feeItemId, deltaKobo } of deltas) {
    if (deltaKobo === 0) continue;

    const at = free.findIndex((copy) => copy.feeItemId === feeItemId);
    if (at === -1) {
      // Nothing was carried for this item — it was settled, or is new. Only
      // more owing creates a carried charge; less owing has nothing to reduce.
      if (deltaKobo > 0) insert.push({ feeItemId, totalKobo: deltaKobo });
      continue;
    }

    const [copy] = free.splice(at, 1);
    const next = copy.totalKobo + deltaKobo;
    // A source charge can fall by more than was carried (some payments on the
    // earlier invoice were never itemised), which simply leaves nothing to carry.
    if (next <= 0) remove.push(copy.id);
    else update.push({ id: copy.id, totalKobo: next, belowPaid: next < copy.paidKobo });
  }

  return { update, remove, insert };
}

/**
 * What an edit does to the invoice's stored charges: which survive (and where
 * they now sit in the list), which are new, and which go.
 *
 * A charge is carried over by fee item, in order of appearance, so an edit that
 * only changes a quantity or a discount updates that charge where it stands
 * rather than replacing it — which is what keeps a payment that was itemised to
 * it pointing at the right row.
 */
export function planLineSync(
  existing: { id: string; feeItemId: string }[],
  incoming: { feeItemId: string }[],
): { keep: { id: string; index: number }[]; insert: number[]; remove: string[] } {
  const unmatched = [...existing];
  const keep: { id: string; index: number }[] = [];
  const insert: number[] = [];

  incoming.forEach((line, index) => {
    const at = unmatched.findIndex((candidate) => candidate.feeItemId === line.feeItemId);
    if (at === -1) {
      insert.push(index);
    } else {
      keep.push({ id: unmatched[at].id, index });
      unmatched.splice(at, 1);
    }
  });

  return { keep, insert, remove: unmatched.map((line) => line.id) };
}

/**
 * Where the invoice's status lands once its total has moved.
 *
 * The status is stored, so an edit that raises the total above what has been
 * paid must reopen a `PAID` invoice, and one that brings it level must settle
 * a `PART_PAID` one.
 */
export function statusAfterEdit(
  totalKobo: number,
  amountPaidKobo: number,
): 'ISSUED' | 'PART_PAID' | 'PAID' {
  if (totalKobo <= 0) return 'PAID';
  if (amountPaidKobo <= 0) return 'ISSUED';
  return amountPaidKobo >= totalKobo ? 'PAID' : 'PART_PAID';
}
