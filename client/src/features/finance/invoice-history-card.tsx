import { useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InvoiceRevision } from '@/types/finance';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { useInvoiceRevisions } from './use-invoices';
import { describeChange, staleCopyNotice } from './invoice-history';

const money = (amount: number) => formatCurrency(amount, 'NGN', { showDecimals: false });

/**
 * Every version an invoice has had, newest first, with what changed in each.
 *
 * Kept below the invoice and never on the paper: the reasons are the office's
 * own notes. An invoice nobody has edited has no versions — which is not a gap
 * in the record but the answer, and the card says so rather than showing
 * nothing.
 */
export function InvoiceHistoryCard({
  invoiceId,
  sentCount,
  lastSentAt,
}: {
  invoiceId: string;
  sentCount: number;
  lastSentAt: string | null | undefined;
}) {
  const revisions = useInvoiceRevisions(invoiceId);
  const rows = revisions.data ?? [];
  const stale = staleCopyNotice(rows, sentCount, lastSentAt);

  return (
    <Card className="no-print" data-cy="finance-invoice-history">
      <CardHeader>
        <CardTitle>Version history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every time this invoice is edited, what it said before is kept here — what changed, who
          changed it and why.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {stale && (
          <Alert
            tone="warning"
            title="The family may be holding an older version"
            data-cy="finance-invoice-history-stale"
          >
            This invoice was changed on {formatDateTime(stale.since)}, after the family was last sent
            a copy. Send it again so they have the current one.
          </Alert>
        )}

        {revisions.isPending ? (
          <LoadingState label="Loading the history…" />
        ) : revisions.isError ? (
          <ErrorState error={revisions.error} onRetry={() => void revisions.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={<History />}
            title="Never edited"
            description="This is still the invoice as it was first issued. Edit it and each change will be recorded here."
            data-cy="finance-invoice-history-empty"
          />
        ) : (
          <ol className="space-y-0" data-cy="finance-invoice-history-list">
            {rows.map((revision, index) => (
              <RevisionRow
                key={revision.id}
                revision={revision}
                isCurrent={index === 0}
                isLast={index === rows.length - 1}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function RevisionRow({
  revision,
  isCurrent,
  isLast,
}: {
  revision: InvoiceRevision;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const original = revision.revisionNo === 1;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* The rail that joins one version to the next. */}
      {!isLast && (
        <span
          className="absolute left-[7px] top-4 h-full w-px bg-border"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'relative mt-1 size-4 shrink-0 rounded-full border-2',
          isCurrent ? 'border-primary bg-primary' : 'border-border bg-card',
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">Version {revision.revisionNo}</span>
          {isCurrent && <Badge tone="primary">Current</Badge>}
          {original && <Badge tone="neutral">Original</Badge>}
          <span className="text-xs text-muted-foreground">
            {original ? 'Issued' : 'Edited'} by {revision.createdByName} ·{' '}
            {formatDateTime(revision.createdAt)}
          </span>
        </div>

        {revision.reason && (
          <p className="rounded-md border-l-4 border-border bg-muted/40 px-3 py-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Reason · </span>
            {revision.reason}
          </p>
        )}

        {revision.changes.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5" data-cy="finance-invoice-history-changes">
            {revision.changes.map((change, index) => (
              <li key={index}>{describeChange(change)}</li>
            ))}
          </ul>
        )}

        {revision.amountPaid > 0 && !original && (
          <p className="text-xs text-muted-foreground">
            {money(revision.amountPaid)} had already been paid when this was changed.
          </p>
        )}

        <button
          type="button"
          data-cy="finance-invoice-history-toggle"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {open ? 'Hide this version' : 'See the invoice as it was'}
        </button>

        {open && <SnapshotView snapshot={revision.snapshot} />}
      </div>
    </li>
  );
}

/** The invoice as one version saw it — its own charges, totals, due date and note. */
function SnapshotView({ snapshot }: { snapshot: InvoiceRevision['snapshot'] }) {
  const unnamedDiscount =
    snapshot.discountTotal - snapshot.appliedDiscounts.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div
      className="space-y-2 rounded-md border border-border p-3"
      data-cy="finance-invoice-history-snapshot"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Charges on this version of the invoice</caption>
        <tbody className="divide-y divide-border">
          {snapshot.lines.map((line, index) => (
            <tr key={`${line.feeItemId}-${index}`}>
              <td className="py-1.5">
                {line.description}
                {line.quantity > 1 && (
                  <span className="ml-1 text-xs text-muted-foreground">× {line.quantity}</span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{money(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="space-y-0.5 border-t border-border pt-2 text-sm">
        <SnapshotRow label="Subtotal" value={money(snapshot.subtotal)} />
        {snapshot.appliedDiscounts.map((entry, index) => (
          <SnapshotRow key={index} label={entry.name} value={`− ${money(entry.amount)}`} />
        ))}
        {unnamedDiscount > 0 && (
          <SnapshotRow label="Charge discounts" value={`− ${money(unnamedDiscount)}`} />
        )}
        {snapshot.broughtForward > 0 && (
          <SnapshotRow label="Brought forward" value={money(snapshot.broughtForward)} />
        )}
        <SnapshotRow label="Total" value={money(snapshot.total)} strong />
      </dl>

      <p className="text-xs text-muted-foreground">
        Due {formatDate(snapshot.dueDate)}
        {snapshot.note ? ` · Note: ${snapshot.note}` : ''}
      </p>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={cn('flex justify-between gap-4', strong && 'font-semibold')}>
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
