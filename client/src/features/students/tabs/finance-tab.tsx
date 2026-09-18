import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Receipt, Trash2, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn, humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentLedger } from '../api';
import { useDeleteInvoices } from '@/features/finance/api';
// Raven's collection-account flow (`PaymentAccountsCard`) is disabled — see
// the note above each commented-out usage below.
// import { PaymentAccountsCard } from '@/features/finance/payment-accounts-card';
import { StatCard } from '@/components/data/stat-card';
import { Card } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/data/data-table';
import { EmptyState, ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
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
  const { membership, can } = useAuth();
  const currency = membership?.branding ? 'NGN' : 'NGN';
  const ledger = useStudentLedger(studentId);
  const deleteInvoices = useDeleteInvoices();
  const [pendingDelete, setPendingDelete] = useState<StudentLedgerEntry | null>(null);
  const canManageInvoices = can('invoice.manage');

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
      // Every invoice line gets a way to open the full document; only a
      // bursar with manage rights also gets to edit or delete it — a payment
      // or a discount is a consequence of an invoice, not a separate thing
      // to open or remove here.
      {
        id: 'actions',
        header: '',
        align: 'right' as const,
        cell: (entry: StudentLedgerEntry) => {
          if (entry.type !== 'INVOICE') return null;
          const deleteButton = (
            <Button
              data-cy="tabs-finance-tab-delete-invoice"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete invoice ${entry.reference}`}
              disabled={!entry.deletable}
              onClick={() => setPendingDelete(entry)}
            >
              <Trash2 />
            </Button>
          );
          return (
            <span className="inline-flex items-center gap-1">
              <Button
                data-cy="tabs-finance-tab-view-invoice"
                variant="ghost"
                size="icon-sm"
                aria-label={`View invoice ${entry.reference}`}
                asChild
              >
                <Link to={`/finance/invoices/${entry.id}`}>
                  <Eye />
                </Link>
              </Button>
              {canManageInvoices && (
                <>
                  <Button
                    data-cy="tabs-finance-tab-edit-invoice"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit invoice ${entry.reference}`}
                    asChild
                  >
                    <Link to={`/finance/invoices/${entry.id}/edit`}>
                      <Pencil />
                    </Link>
                  </Button>
                  {entry.deletable ? (
                    deleteButton
                  ) : (
                    <Tooltip content="Refused: this invoice has a payment recorded against it, or carries a balance to or from another invoice.">
                      <span className="inline-flex">{deleteButton}</span>
                    </Tooltip>
                  )}
                </>
              )}
            </span>
          );
        },
      },
    ],
    [currency, canManageInvoices],
  );

  // Collecting money works before the ledger does: a Raven account number
  // can be issued and paid into whether or not the statement below can be
  // drawn yet, so it sits above and outside the ledger's own loading states.
  if (ledger.isPending) {
    return (
      <div className="space-y-6">
        {/* <PaymentAccountsCard studentId={studentId} currency={currency} /> */}
        <LoadingState label="Loading fee history…" />
      </div>
    );
  }
  if (ledger.isError) {
    return (
      <div className="space-y-6">
        {/* <PaymentAccountsCard studentId={studentId} currency={currency} /> */}
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
      </div>
    );
  }

  const summary = ledger.data?.summary;
  const entries = ledger.data?.entries ?? [];

  return (
    <div className="space-y-6">
      {/*
        Disabled: Raven's collection-account issuing is not working end to end
        yet. Re-enable by uncommenting this and the import above once it is.
      */}
      {/* <PaymentAccountsCard studentId={studentId} currency={currency} /> */}

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
          <Button data-cy="tabs-finance-tab-create-invoice" variant="outline" asChild>
            <Link to={`/finance/invoices/new?studentId=${studentId}`}>
              <Receipt />
              Create invoice
            </Link>
          </Button>
        </PermissionGate>
        <PermissionGate require="payment.manage">
          <Button data-cy="tabs-finance-tab-record-payment" asChild>
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
          data-cy="student-finance-table"
          caption="Statement of account showing every charge, payment and the running balance"
          data={entries}
          columns={columns}
          rowKey={(entry) => entry.id}
        />
      )}

      <ConfirmDialog
        data-cy="tabs-finance-tab-delete-invoice-confirm"
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        tone="danger"
        title="Delete this invoice?"
        description={`"${pendingDelete?.reference}" will be removed entirely, not just cancelled. This is refused if it has a payment recorded against it, or carries a balance to or from another invoice.`}
        confirmLabel="Delete"
        loading={deleteInvoices.isPending}
        onConfirm={async () => {
          if (pendingDelete) {
            await deleteInvoices.mutateAsync([pendingDelete.id]);
            void ledger.refetch();
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
