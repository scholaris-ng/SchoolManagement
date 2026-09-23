/** Money is held as a string in these forms; two places, and no float dust. */
function toAmountString(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * How a payment falls across an invoice's charges when nobody has said
 * otherwise: down the list in order, each charge taking as much as it still
 * needs, until the money runs out.
 *
 * The same rule `PaymentFormPage` already applies across whole invoices, one
 * level down — it settles the earliest charges in full and leaves only the
 * last one it reaches part-paid, which is what a bursar writing this out by
 * hand would do, and it means the common case (a family clearing the bill, or
 * paying the first few items off) needs no typing at all.
 */
export function splitAcrossLines<T extends { id: string }>(
  lines: T[],
  roomOn: (line: T) => number,
  total: number,
): Record<string, string> {
  const split: Record<string, string> = {};
  let remaining = total;

  for (const line of lines) {
    if (remaining <= 0) break;
    const applied = Math.min(roomOn(line), remaining);
    if (applied > 0) {
      split[line.id] = toAmountString(applied);
      remaining -= applied;
    }
  }

  return split;
}

/** What a set of typed-in amounts comes to, ignoring anything left blank. */
export function sumAmounts(amounts: Record<string, string>): number {
  return Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
