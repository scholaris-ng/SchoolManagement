import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCheck, CreditCard, Download, Plus, Receipt } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { usePayments, useReconcilePayment } from './api';
import type { Payment } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PermissionGate } from '@/components/guards/permission-gate';

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'POS', label: 'POS' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const RECONCILED_OPTIONS = [
  { value: 'false', label: 'Not reconciled' },
  { value: 'true', label: 'Reconciled' },
];

export function PaymentsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListQuery({
    filterKeys: ['method', 'status', 'reconciled'],
    defaultSortBy: 'paidAt',
    defaultSortDir: 'desc',
  });
  const payments = usePayments(list.query);
  const reconcile = useReconcilePayment();
  const [pendingReconcile, setPendingReconcile] = useState<Payment | null>(null);

  const currency = 'NGN';

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (payment: Payment) => navigate(`/finance/receipts/${payment.id}`),
    [navigate],
  );

  const columns = useMemo<Column<Payment>[]>(
    () => [
      {
        id: 'payment',
        header: 'Receipt',
        cell: (payment) => (
          <div className="min-w-0">
            <Link
              to={`/finance/receipts/${payment.id}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {payment.receiptNo ?? payment.reference}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {formatDateTime(payment.paidAt)}
            </p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        cell: (payment) => (
          <div className="min-w-0">
            <p className="truncate">{payment.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">{payment.admissionNo}</p>
          </div>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        hideOnMobile: true,
        cell: (payment) => (
          <div className="min-w-0">
            <p>{humanizeEnum(payment.method)}</p>
            {payment.provider && payment.provider !== 'MANUAL' && (
              <p className="truncate text-xs text-muted-foreground">
                {humanizeEnum(payment.provider)}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        align: 'right',
        sortKey: 'amount',
        cell: (payment) => (
          <div>
            <p className="font-medium tabular-nums">
              {formatCurrency(payment.amount, currency, { showDecimals: false })}
            </p>
            {payment.unallocatedAmount > 0 && (
              <p className="text-xs text-warning">
                {formatCurrency(payment.unallocatedAmount, currency, { showDecimals: false })} on
                account
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'allocations',
        header: 'Applied to',
        hideOnMobile: true,
        cell: (payment) =>
          payment.allocations.length === 0 ? (
            <span className="text-muted-foreground">Unapplied</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {payment.allocations.map((allocation) => (
                <Badge key={allocation.id} tone="neutral">
                  {allocation.invoiceNo}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (payment) => (
          <div className="space-y-1">
            <StatusBadge status={payment.status} />
            {!payment.isReconciled && <Badge tone="warning">Unreconciled</Badge>}
          </div>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (payment) =>
          !payment.isReconciled && can('payment.reconcile') ? (
            <Button
              data-cy="finance-payments-reconcile"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setPendingReconcile(payment);
              }}
            >
              <CheckCheck />
              Reconcile
            </Button>
          ) : null,
      },
    ],
    [can],
  );

  const exportPayments = () => {
    void exportRowsToXlsx(
      `payments-${new Date().toISOString().slice(0, 10)}.xlsx`,
      (payments.data?.items ?? []).map((payment) => ({
        Receipt: payment.receiptNo ?? '',
        Reference: payment.reference,
        Student: payment.studentName,
        'Admission no': payment.admissionNo,
        Amount: payment.amount,
        Method: payment.method,
        Status: payment.status,
        'Paid at': payment.paidAt,
        Reconciled: payment.isReconciled ? 'Yes' : 'No',
        'Recorded by': payment.recordedByName ?? '',
      })),
      { sheetName: 'Payments' },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Payments"
        description="Every payment received, how it was applied, and what still needs reconciling against the bank."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments' }]}
        actions={
          <>
            <Button data-cy="finance-payments-export" variant="outline" onClick={exportPayments}>
              <Download />
              Export
            </Button>
            <PermissionGate require="payment.manage">
              <Button data-cy="finance-payments-record-payment" asChild>
                <Link to="/finance/payments/new">
                  <Plus />
                  Record payment
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by receipt, reference or student…"
        isSearching={list.isSearchPending || payments.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'method', label: 'Method', options: METHOD_OPTIONS, allLabel: 'All methods' },
          {
            key: 'reconciled',
            label: 'Reconciliation',
            options: RECONCILED_OPTIONS,
            allLabel: 'All payments',
          },
        ]}
      />

      <DataTable

        data-cy="finance-payments-table"
        caption="Payments with student, amount, method, allocation and reconciliation status"
        data={payments.data?.items}
        meta={payments.data?.meta}
        columns={columns}
        rowKey={(payment) => payment.id}
        isLoading={payments.isPending}
        isFetching={payments.isFetching}
        error={payments.error}
        onRetry={() => void payments.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={handleRowClick}
        emptyIcon={<CreditCard />}
        emptyTitle={list.isFiltered ? 'No payments match those filters' : 'No payments recorded yet'}
        emptyDescription={
          list.isFiltered ? 'Try clearing the filters.' : 'Record a cash, transfer or POS payment.'
        }
        emptyAction={
          <PermissionGate require="payment.manage">
            <Button data-cy="finance-payments-record-the-first-payment" asChild>
              <Link to="/finance/payments/new">
                <Receipt />
                Record the first payment
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <ConfirmDialog
        open={pendingReconcile !== null}
        onOpenChange={(open) => !open && setPendingReconcile(null)}
        title="Mark this payment as reconciled?"
        description={
          pendingReconcile
            ? `Confirm that ${formatCurrency(pendingReconcile.amount, currency)} from ${pendingReconcile.studentName} has been matched against the bank statement. This is recorded against your name.`
            : ''
        }
        confirmLabel="Reconcile"
        loading={reconcile.isPending}
        onConfirm={async () => {
          if (!pendingReconcile) return;
          await reconcile.mutateAsync({ id: pendingReconcile.id });
          setPendingReconcile(null);
        }}
      />
    </PageContainer>
  );
}
