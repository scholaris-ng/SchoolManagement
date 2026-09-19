import { formatCurrency } from '@/lib/format';
import type { Term } from '@/types/academics';
import type { Discount, StudentDiscount } from '@/types/finance';

/** "50%" or "₦10,000" — what a discount is worth, in the form a bursar quotes it. */
export function describeDiscountValue(discount: Pick<Discount, 'mode' | 'value'>): string {
  return discount.mode === 'PERCENTAGE'
    ? `${discount.value}%`
    : formatCurrency(discount.value, 'NGN', { showDecimals: false });
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
