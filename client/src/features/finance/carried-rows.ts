import type { CarriedInvoice } from '@/types/finance';

/** One printed row of a balance brought forward: a fee item, or the row that squares the list. */
export interface CarriedRow {
  key: string;
  label: string;
  /** What the item was billed at; none for the squaring row. */
  billed: number | null;
  /** What had already been paid toward it before it was carried. */
  paid: number | null;
  /** What was left — negative for payments that were never tied to a fee item. */
  balance: number;
}

/**
 * The rows a carried balance prints as, for the invoice screen and the POS
 * slip alike: every fee item with something still owing, then — only when the
 * items do not already add up to what moved across — one row for the
 * difference, so the balance column always comes to the figure the total counts.
 */
export function carriedRows(source: CarriedInvoice): CarriedRow[] {
  const rows: CarriedRow[] = source.items.map((item, index) => ({
    key: `${source.invoiceId}:${index}`,
    label: item.description,
    billed: item.amount,
    paid: item.paid,
    balance: item.balance,
  }));

  if (Math.abs(source.unassigned) > 0.004) {
    rows.push({
      key: `${source.invoiceId}:unassigned`,
      label:
        source.unassigned < 0 ? 'Payments not tied to a fee item' : 'Earlier balance brought forward',
      billed: null,
      paid: source.unassigned < 0 ? -source.unassigned : null,
      balance: source.unassigned,
    });
  }

  return rows;
}
