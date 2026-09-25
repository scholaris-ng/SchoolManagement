import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { useInvoiceDetails } from './api';

const naira = (amount: number) => formatCurrency(amount, 'NGN', { showDecimals: false });

/**
 * A student's earlier invoice(s) for the same term, fee item by fee item, and
 * the choice of whether this new invoice takes over what is still owing on
 * them.
 *
 * Shown on a follow-up invoice, where the standard fees are already billed.
 * Carrying moves the unpaid balance onto the new invoice and closes the old
 * one, so the family owes it once — the same carry-and-close a later term does
 * on its own. Left unticked, the new invoice is a separate bill and the old
 * one stays open beside it, which is right for a second bill raised for
 * something else altogether.
 */
export function TermBilledCard({
  invoices,
  carry,
  onCarryChange,
}: {
  /** Every live invoice this term, whether or not anything is left on it. */
  invoices: Invoice[];
  carry: boolean;
  onCarryChange: (carry: boolean) => void;
}) {
  const details = useInvoiceDetails(invoices.map((invoice) => invoice.id));
  const owing = invoices.filter((invoice) => invoice.balance > 0);
  const owingTotal = owing.reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <Card data-cy="finance-invoice-form-term-billed">
      <CardHeader>
        <CardTitle>Already billed this term</CardTitle>
        <CardDescription>
          What is still to be paid on this student's earlier invoice for the term.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoices.map((invoice, index) => {
          const detail = details[index];
          const settled = invoice.balance <= 0;
          // A line's own balance only moves when a payment names it, so on an
          // invoice already cleared in full it can still read as owing.
          const leftOn = (lineBalance: number) => (settled ? 0 : lineBalance);
          const lines = detail?.data?.lines ?? [];
          const leftTotal = lines.reduce((sum, line) => sum + leftOn(line.balance), 0);
          const unitemized = !settled && leftTotal - invoice.balance > 0.004;

          return (
            <section key={invoice.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{invoice.invoiceNo}</p>
                <p
                  className={cn(
                    'text-sm tabular-nums',
                    settled ? 'text-success' : 'font-medium text-danger',
                  )}
                >
                  {settled ? 'Paid in full' : `${naira(invoice.balance)} left to pay`}
                </p>
              </div>

              {detail?.isPending ? (
                <p className="text-xs text-muted-foreground">Loading fee items…</p>
              ) : detail?.isError ? (
                <p className="text-xs text-danger">Couldn't load this invoice's fee items.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {lines.map((line) => {
                    const left = leftOn(line.balance);
                    return (
                      <li key={line.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{line.description}</p>
                          <p className="text-xs text-muted-foreground">
                            billed {naira(line.lineTotal)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-right tabular-nums',
                            left > 0 ? 'font-medium' : 'text-xs text-muted-foreground',
                          )}
                        >
                          {left > 0 ? `${naira(left)} left` : 'Paid'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {unitemized && (
                <p className="text-xs text-muted-foreground">
                  Some payments on this invoice were not tied to a fee item, so what is left overall (
                  {naira(invoice.balance)}) is lower than the items above add up to.
                </p>
              )}
            </section>
          );
        })}

        {owing.length > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
            <input
              data-cy="finance-invoice-form-carry"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input"
              checked={carry}
              onChange={(event) => onCarryChange(event.target.checked)}
            />
            <span className="min-w-0">
              <span className="font-medium">
                Carry the {naira(owingTotal)} still owing onto this invoice
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {carry
                  ? `${owing.map((invoice) => invoice.invoiceNo).join(', ')} will be closed and its balance billed here instead, so it is owed once. Cancelling this invoice reopens it.`
                  : 'Left unticked, this is a separate bill and the earlier invoice stays open beside it.'}
              </span>
            </span>
          </label>
        )}
      </CardContent>
    </Card>
  );
}
