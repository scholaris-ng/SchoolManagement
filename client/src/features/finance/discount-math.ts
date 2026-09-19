import type { AppliedDiscount, Discount } from '@/types/finance';

const MONEY_SCALE = 100;

export type PreviewDiscount = Pick<
  Discount,
  'id' | 'name' | 'type' | 'mode' | 'value' | 'appliesToFeeItemIds'
>;

export interface PreviewLine {
  feeItemId: string;
  unitAmount: number;
  quantity: number;
}

/**
 * What the invoice screens show a bursar before they save. It mirrors
 * `applyDiscounts` on the server, which stays the only thing that ever writes
 * an amount to an invoice — this is a preview, so a figure that ever differed
 * would be a display bug, never a wrong bill.
 *
 * A percentage is taken from each in-scope line's full price; a fixed amount
 * is one flat sum for the whole invoice, spread down the in-scope lines. The
 * discounts are handled in the order given and together never take a line
 * below zero. One that ends up waiving nothing is left out.
 */
export function previewDiscounts(
  lines: PreviewLine[],
  discounts: PreviewDiscount[],
): { applied: AppliedDiscount[]; total: number } {
  const gross = lines.map((line) => Math.round(line.unitAmount * line.quantity * MONEY_SCALE));
  const taken = lines.map(() => 0);
  const applied: AppliedDiscount[] = [];

  for (const discount of discounts) {
    const inScope = lines
      .map((line, index) => ({ line, index }))
      .filter(
        ({ line }) =>
          discount.appliesToFeeItemIds.length === 0 ||
          discount.appliesToFeeItemIds.includes(line.feeItemId),
      )
      .map(({ index }) => index);

    let waived = 0;
    if (discount.mode === 'PERCENTAGE') {
      for (const index of inScope) {
        const off = Math.min(
          gross[index] - taken[index],
          Math.round((gross[index] * discount.value) / 100),
        );
        taken[index] += off;
        waived += off;
      }
    } else {
      let remaining = Math.round(discount.value * MONEY_SCALE);
      for (const index of inScope) {
        if (remaining <= 0) break;
        const off = Math.min(gross[index] - taken[index], remaining);
        taken[index] += off;
        remaining -= off;
        waived += off;
      }
    }

    if (waived > 0) {
      applied.push({
        discountId: discount.id,
        name: discount.name,
        type: discount.type,
        mode: discount.mode,
        value: discount.value,
        amount: waived / MONEY_SCALE,
      });
    }
  }

  return { applied, total: taken.reduce((sum, kobo) => sum + kobo, 0) / MONEY_SCALE };
}
