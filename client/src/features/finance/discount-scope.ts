import { formatCurrency } from '@/lib/format';
import type { Term } from '@/types/academics';
import type { Discount, StudentDiscount } from '@/types/finance';

/** "50%" or "₦10,000" — what a discount is worth, in the form a bursar quotes it. */
export function describeDiscountValue(discount: Pick<Discount, 'mode' | 'value'>): string {
  return discount.mode === 'PERCENTAGE'
    ? `${discount.value}%`
    : formatCurrency(discount.value, 'NGN', { showDecimals: false });
}

/** Which charges a discount reaches, in words — "every charge" or the fee items it's limited to. */
export function describeDiscountScope(
  discount: Pick<Discount, 'appliesToFeeItemIds'>,
  feeItemNameById: Map<string, string>,
): string {
  if (discount.appliesToFeeItemIds.length === 0) return 'every charge';
  return discount.appliesToFeeItemIds
    .map((id) => feeItemNameById.get(id) ?? 'a removed fee item')
    .join(', ');
}

/**
 * A discount's own definition can already be limited to certain fee items
 * (set under Finance → Fees → Discounts); a bursar ticking it onto one bill
 * can narrow that further — to just the Tuition line, say — but never widen
 * it past what the discount was defined for. Mirrors the same combination
 * `InvoicesService.discountsFor` does server-side, so the preview a bursar
 * sees while building an invoice never disagrees with what gets billed.
 */
export function resolveDiscountScope(definitionScope: string[], chosenScope: string[]): string[] {
  if (definitionScope.length === 0) return chosenScope;
  if (chosenScope.length === 0) return definitionScope;
  return definitionScope.filter((id) => chosenScope.includes(id));
}

/** Which bills a grant reaches, in words. */
export function describeGrantScope(
  grant: Pick<StudentDiscount, 'termName' | 'sessionName' | 'termId' | 'sessionId'>,
): string {
  if (grant.termId) return `${grant.termName ?? 'One term'} · ${grant.sessionName ?? ''}`.trim();
  if (grant.sessionId) return `Every term of ${grant.sessionName ?? 'one session'}`;
  return 'Every term until removed';
}

/** Whether a grant would be picked up by a bill for this term — mirrors the server's own scope match. */
export function grantReachesTerm(
  grant: Pick<StudentDiscount, 'termId' | 'sessionId'>,
  term: Pick<Term, 'id' | 'sessionId'>,
): boolean {
  return (
    (grant.termId === null || grant.termId === term.id) &&
    (grant.sessionId === null || grant.sessionId === term.sessionId)
  );
}
