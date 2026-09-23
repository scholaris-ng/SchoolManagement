import type { DiscountMode, DiscountType } from '../entities/discount.entity';

const MONEY_SCALE = 100;

/** A discount granted to a student that is in scope for the bill being raised. */
export interface ApplicableDiscount {
  discountId: string;
  name: string;
  type: DiscountType;
  mode: DiscountMode;
  value: number;
  /** Empty means every line on the invoice. */
  appliesToFeeItemIds: string[];
}

/** What one discount actually took off one invoice — snapshotted on the invoice. */
export interface AppliedDiscount {
  discountId: string;
  name: string;
  type: DiscountType;
  mode: DiscountMode;
  value: number;
  amount: number;
}

export interface DiscountableLine {
  feeItemId: string;
  unitAmount: number;
  quantity: number;
  discountAmount: number;
}

/**
 * A discount's own definition can already be limited to certain fee items
 * (`Discount.appliesToFeeItemIds`); a bursar ticking it onto one bill can
 * narrow that further — to just the Tuition line, say — but never widen it
 * past what the discount was defined for. Mirrored on the client
 * (`discount-scope.ts`) so a bursar's preview never disagrees with this.
 */
export function resolveDiscountScope(definitionScope: string[], chosenScope: string[]): string[] {
  if (definitionScope.length === 0) return chosenScope;
  if (chosenScope.length === 0) return definitionScope;
  return definitionScope.filter((id) => chosenScope.includes(id));
}

/**
 * Works out what a student's granted discounts take off an invoice.
 *
 * A percentage is taken from each in-scope line's full price, and a fixed
 * amount is a flat sum for the whole invoice, spread down the in-scope lines
 * in order. Discounts are handled in the order given, and together can never
 * take a line below zero — a 100% scholarship stacked with a 50% staff-child
 * concession waives the line once, not one and a half times.
 *
 * Any discount already on a line (typed by hand) counts as taken, so the two
 * never add up to more than the charge. A discount that ends up waiving
 * nothing — none of its fee items are on this bill — is left out of `applied`,
 * so an invoice never claims a reason for a reduction it does not carry.
 *
 * Kobo throughout, and returned as amounts per line, so the caller's totals
 * are sums of whole kobo and cannot drift by a rounding error.
 */
export function applyDiscounts(
  lines: DiscountableLine[],
  discounts: ApplicableDiscount[],
): { lineDiscounts: number[]; applied: AppliedDiscount[] } {
  const gross = lines.map((line) => Math.round(line.unitAmount * line.quantity * MONEY_SCALE));
  const taken = lines.map((line, index) =>
    Math.min(gross[index], Math.round(line.discountAmount * MONEY_SCALE)),
  );
  const applied: AppliedDiscount[] = [];

  for (const discount of discounts) {
    const inScope = Array.from(lines.keys()).filter(
      (index) =>
        discount.appliesToFeeItemIds.length === 0 ||
        discount.appliesToFeeItemIds.includes(lines[index].feeItemId),
    );

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
        discountId: discount.discountId,
        name: discount.name,
        type: discount.type,
        mode: discount.mode,
        value: discount.value,
        amount: waived / MONEY_SCALE,
      });
    }
  }

  return { lineDiscounts: taken.map((kobo) => kobo / MONEY_SCALE), applied };
}
