import { Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { AccountSummaryRow } from './account-summary';

/**
 * How much to send to each account, in one card per account.
 *
 * Deliberately not a table of "mandatory / optional" columns: an account
 * that only carries optional charges has nothing mandatory to show, and a
 * bold ₦0 headline reads as broken, not as "zero". Instead, whichever figure
 * is the real one to send leads; a small "Optional" tag says so where that
 * matters, rather than a confusing zero next to it.
 */
export function PaymentSummary({
  rows,
  currency,
  accent,
}: {
  rows: AccountSummaryRow[];
  currency: string;
  accent: string;
}) {
  return (
    <div className="border-t border-border pt-4">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
        Payment summary
      </p>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Pay each account's own total below in a single transfer.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row) => {
          const hasMandatory = row.mandatory > 0;
          const leadAmount = hasMandatory ? row.mandatory : row.optional;
          return (
            <div
              key={row.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: `${accent}22`, color: accent }}
                >
                  <Landmark className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.label || row.bankName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.label ? `${row.bankName} · ` : ''}
                    {row.accountNumber} · {row.accountName}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold leading-tight" style={{ color: accent }}>
                  {formatCurrency(leadAmount, currency, { showDecimals: false })}
                </p>
                {!hasMandatory && (
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Optional
                  </p>
                )}
                {hasMandatory && row.optional > 0 && (
                  <p className="text-xs text-muted-foreground">
                    + {formatCurrency(row.optional, currency, { showDecimals: false })} optional
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
