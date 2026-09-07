import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn, humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentLedger } from '../api';
import { StatCard } from '@/components/data/stat-card';
import { Card } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/data/data-table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { StudentLedgerEntry } from '@/types/finance';

/**
 * The ledger, not a balance field.
 *
 * Every invoice, payment, discount and adjustment is listed with a running
 * balance, so the figure at the bottom can always be explained line by line
 * (spec section 26).
 */
export function StudentFinanceTab({ studentId }: { studentId: string }) {
  const { membership } = useAuth();
  const currency = membership?.branding ? 'NGN' : 'NGN';
  const ledger = useStudentLedger(studentId);

  const columns = useMemo<Column<StudentLedgerEntry>[]>(
    () => [
      { id: 'date', header: 'Date', cell: (entry) => formatDate(entry.date) },
      {
        id: 'description',
        header: 'Description',
        cell: (entry) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{entry.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {humanizeEnum(entry.type)} · {entry.reference}
            </p>
          </div>
        ),
      },
      {
        id: 'debit',
        header: 'Charged',
        align: 'right',
        cell: (entry) =>
          entry.debit > 0 ? (
            <span className="tabular-nums">{formatCurrency(entry.debit, currency)}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'credit',
        header: 'Paid',
        align: 'right',
        cell: (entry) =>
          entry.credit > 0 ? (
            <span className="tabular-nums text-success">
              {formatCurrency(entry.credit, currency)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'balance',
        header: 'Balance',
        align: 'right',
        cell: (entry) => (
          <span
            className={cn(
              'font-medium tabular-nums',
              entry.runningBalance > 0 ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {formatCurrency(entry.runningBalance, currency)}
          </span>
        ),
      },
    ],
    [currency],
  );

  if (ledger.isPending) return <LoadingState label="Loading fee history…" />;
  if (ledger.isError) return <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />;

  const summary = ledger.data?.summary;
  const entries = ledger.data?.entries ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total billed" value={formatCurrency(summary?.totalBilled ?? 0, currency)} />
        <StatCard
          label="Total paid"
          value={formatCurrency(summary?.totalPaid ?? 0, currency)}
          tone="success"
        />
        <StatCard
          label="Discounts"
          value={formatCurrency(summary?.totalDiscount ?? 0, currency)}
          hint="Sibling, staff-child and scholarship reductions"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary?.balance ?? 0, currency)}
          tone={(summary?.balance ?? 0) > 0 ? 'danger' : 'success'}
          hint={
            summary?.overdueInvoices
              ? `${summary.overdueInvoices} overdue invoice${summary.overdueInvoices === 1 ? '' : 's'}`
              : 'Nothing overdue'
          }
        />
      </div>

      <div className="flex justify-end gap-2">
        <PermissionGate require="invoice.manage">
          <Button variant="outline" asChild>
            <Link to={`/finance/invoices/new?studentId=${studentId}`}>
              <Receipt />
              Create invoice
            </Link>
          </Button>
        </PermissionGate>
        <PermissionGate require="payment.manage">
          <Button asChild>
            <Link to={`/finance/payments/new?studentId=${studentId}`}>
              <Wallet />
              Record payment
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="No fee history yet"
            description="Invoices and payments for this student will appear here as a running account."
          />
        </Card>
      ) : (
        <DataTable
          caption="Statement of account showing every charge, payment and the running balance"
          data={entries}
          columns={columns}
          rowKey={(entry) => entry.id}
        />
      )}
    </div>
  );
}
