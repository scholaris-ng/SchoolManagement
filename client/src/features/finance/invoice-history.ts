import { formatCurrency, formatDate } from '@/lib/format';
import type { InvoiceChange, InvoiceRevision } from '@/types/finance';

const naira = (amount: number | string | null) =>
  formatCurrency(typeof amount === 'number' ? amount : Number(amount ?? 0), 'NGN', {
    showDecimals: false,
  });

/**
 * One change, as a sentence an office clerk would say it.
 *
 * Money is shown to the whole naira: an invoice is never kept in kobo on
 * paper, and a correction that moves by kobo is a rounding, not a decision.
 */
export function describeChange(change: InvoiceChange): string {
  const label = change.label ?? '';

  switch (change.kind) {
    case 'LINE_REMOVED':
      return `Removed ${label} (${naira(change.from)})`;
    case 'LINE_ADDED':
      return `Added ${label} (${naira(change.to)})`;
    case 'LINE_CHANGED':
      return `${label}: ${naira(change.from)} → ${naira(change.to)}${
        change.detail ? ` (${change.detail})` : ''
      }`;
    case 'DUE_DATE':
      return `Due date: ${formatDate(String(change.from))} → ${formatDate(String(change.to))}`;
    case 'NOTE':
      if (!change.from) return 'Note added';
      if (!change.to) return 'Note removed';
      return 'Note edited';
    case 'DISCOUNT':
      return `Discounts: ${naira(change.from)} → ${naira(change.to)}`;
    case 'BROUGHT_FORWARD':
      return `Brought forward: ${naira(change.from)} → ${naira(change.to)}`;
    case 'TOTAL':
      return `Total: ${naira(change.from)} → ${naira(change.to)}`;
  }
}

/**
 * Whether the family may be holding an older version than the one on file:
 * they were sent a copy, and the invoice changed after the latest one went out.
 * `null` when there is nothing to say — never sent, never edited, or sent since.
 */
export function staleCopyNotice(
  revisions: Pick<InvoiceRevision, 'createdAt' | 'revisionNo'>[],
  sentCount: number,
  lastSentAt: string | null | undefined,
): { since: string } | null {
  if (revisions.length === 0 || sentCount === 0 || !lastSentAt) return null;

  const latest = revisions.reduce((a, b) => (b.revisionNo > a.revisionNo ? b : a));
  // Version 1 is the original, not a change: only a later version can be newer
  // than a copy that went out.
  if (latest.revisionNo <= 1) return null;

  return new Date(latest.createdAt).getTime() > new Date(lastSentAt).getTime()
    ? { since: latest.createdAt }
    : null;
}
