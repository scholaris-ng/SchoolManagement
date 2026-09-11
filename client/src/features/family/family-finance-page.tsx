import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, Receipt, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { useParentDashboard } from '@/features/dashboard/api';
import { useInvoices, usePayments } from '@/features/finance/api';
import { useStudentLedger } from '@/features/students/api';
import { useActiveChild } from './use-active-child';
import { ChildSwitcher } from './child-switcher';
import type { Invoice, Payment, StudentLedgerEntry } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { StatusBadge } from '@/components/data/status-badge';
import { DataTable, type Column } from '@/components/data/data-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * Fees, from a parent's point of view.
 *
 * The balance is never a single stored number — it is derived from the invoices
 * raised and the payments received (spec section 26), and that is exactly how
 * it is shown here: what was billed, what has been paid, and the running
 * statement that explains the difference.
 */
export function FamilyFinancePage() {
  const dashboard = useParentDashboard();
  const data = dashboard.data;
  const currency = data?.currency ?? 'NGN';

  const { children, activeChild, activeChildId, setActiveChildId } = useActiveChild(data?.children);
  const studentId = activeChild?.studentId;

  const ledger = useStudentLedger(studentId);
  // Held back until a child is selected: without the filter these would fetch
  // every child's invoices, which is both wasted data and the wrong answer.
  const invoices = useInvoices(
    { page: 1, pageSize: 25, studentId: studentId ?? '' },
    { enabled: Boolean(studentId) },
  );
  const payments = usePayments(
    { page: 1, pageSize: 25, studentId: studentId ?? '' },
    { enabled: Boolean(studentId) },
  );

  const summary = ledger.data?.summary;
  const totalOutstanding = children.reduce((sum, child) => sum + child.outstandingBalance, 0);

  const invoiceColumns = useMemo<Column<Invoice>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.invoiceNo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.termName} · {row.sessionName}
            </p>
          </div>
        ),
      },
      {
        id: 'due',
        header: 'Due',
        hideOnMobile: true,
        cell: (row) => formatDate(row.dueDate),
      },
      {
        id: 'total',
        header: 'Total',
        align: 'right',
        cell: (row) => (
          <span className="tabular-nums">
            {formatCurrency(row.total, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Outstanding',
        align: 'right',
        cell: (row) => (
          <span
            className={cn('font-medium tabular-nums', row.balance > 0 ? 'text-danger' : 'text-success')}
          >
            {row.balance > 0
              ? formatCurrency(row.balance, currency, { showDecimals: false })
              : 'Settled'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        cell: (row) => <StatusBadge status={row.status} />,
      },
    ],
    [currency],
  );

  const paymentColumns = useMemo<Column<Payment>[]>(
    () => [
      {
        id: 'paid',
        header: 'Paid',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{formatDate(row.paidAt)}</p>
            <p className="truncate text-xs text-muted-foreground">{row.reference}</p>
          </div>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        hideOnMobile: true,
        cell: (row) => <span className="capitalize">{row.method.replace(/_/g, ' ').toLowerCase()}</span>,
      },
      {
        id: 'amount',
        header: 'Amount',
        align: 'right',
        cell: (row) => (
          <span className="font-medium tabular-nums text-success">
            {formatCurrency(row.amount, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'receipt',
        header: <span className="sr-only">Receipt</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (row) =>
          row.status === 'SUCCESSFUL' ? (
            <Button data-cy="family-finance-receipt" variant="ghost" size="sm" asChild>
              <Link to={`/finance/receipts/${row.id}`}>
                <Receipt />
                Receipt
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [currency],
  );

  const ledgerColumns = useMemo<Column<StudentLedgerEntry>[]>(
    () => [
      { id: 'date', header: 'Date', cell: (row) => formatDate(row.date) },
      {
        id: 'description',
        header: 'Description',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate">{row.description}</p>
            <p className="truncate text-xs text-muted-foreground">{row.reference}</p>
          </div>
        ),
      },
      {
        id: 'debit',
        header: 'Charged',
        align: 'right',
        cell: (row) =>
          row.debit ? (
            <span className="tabular-nums">
              {formatCurrency(row.debit, currency, { showDecimals: false })}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'credit',
        header: 'Paid',
        align: 'right',
        cell: (row) =>
          row.credit ? (
            <span className="tabular-nums text-success">
              {formatCurrency(row.credit, currency, { showDecimals: false })}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'running',
        header: 'Balance',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.runningBalance, currency, { showDecimals: false })}
          </span>
        ),
      },
    ],
    [currency],
  );

  const header = (
    <PageHeader
      title="Fees & payments"
      description="What has been billed, what you have paid, and what is still outstanding."
      breadcrumbs={[{ label: 'My children', to: '/family' }, { label: 'Fees & payments' }]}
    />
  );

  if (dashboard.isError) {
    return (
      <PageContainer>
        {header}
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  if (dashboard.isPending) {
    return (
      <PageContainer>
        {header}
        <LoadingState label="Loading your account…" />
      </PageContainer>
    );
  }

  if (children.length === 0) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          icon={<Wallet />}
          title="No children linked to your account yet"
          description="Fees appear here once the school links your children to this account."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}

      {children.length > 1 && totalOutstanding > 0 && (
        <Alert tone="warning" title="Across all your children">
          {formatCurrency(totalOutstanding, currency)} is outstanding in total. Select each child
          below to see their own statement.
        </Alert>
      )}

      <ChildSwitcher
        children={children}
        activeChildId={activeChildId}
        onSelect={setActiveChildId}
        currency={currency}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Billed"
          value={formatCurrency(summary?.totalBilled ?? 0, currency, { showDecimals: false })}
          icon={<Wallet />}
          loading={ledger.isPending}
        />
        <StatCard
          label="Paid"
          value={formatCurrency(summary?.totalPaid ?? 0, currency, { showDecimals: false })}
          tone="success"
          icon={<Receipt />}
          loading={ledger.isPending}
        />
        <StatCard
          label="Discounts"
          value={formatCurrency(summary?.totalDiscount ?? 0, currency, { showDecimals: false })}
          icon={<Wallet />}
          loading={ledger.isPending}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary?.balance ?? 0, currency, { showDecimals: false })}
          tone={(summary?.balance ?? 0) > 0 ? 'danger' : 'success'}
          hint={
            summary?.lastPaymentAt
              ? `Last payment ${formatDate(summary.lastPaymentAt)}`
              : 'No payment recorded yet'
          }
          icon={<Wallet />}
          loading={ledger.isPending}
        />
      </div>

      {(summary?.overdueInvoices ?? 0) > 0 && (
        <Alert tone="danger" title="An invoice is past its due date">
          {summary?.overdueInvoices} invoice{summary?.overdueInvoices === 1 ? ' is' : 's are'}{' '}
          overdue for {activeChild?.fullName}. Contact the bursar&rsquo;s office if you need to agree
          a payment plan.
        </Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Statement</CardTitle>
            <CardDescription>
              Every charge and payment for {activeChild?.fullName ?? 'this child'}, in order.
            </CardDescription>
          </div>
          <Button
            data-cy="family-finance-print"
            variant="outline"
            size="sm"
            disabled={(ledger.data?.entries.length ?? 0) === 0}
            onClick={() => window.print()}
          >
            <Download />
            Print
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data-cy="family-finance-table"
            className="rounded-none border-0"
            caption={`Fee statement for ${activeChild?.fullName ?? 'this child'}`}
            data={ledger.data?.entries}
            columns={ledgerColumns}
            rowKey={(row) => row.id}
            isLoading={ledger.isPending}
            error={ledger.error}
            onRetry={() => void ledger.refetch()}
            emptyIcon={<Wallet />}
            emptyTitle="Nothing billed yet"
            emptyDescription="Charges appear here as soon as the school raises an invoice."
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data-cy="family-finance-table-2"
              className="rounded-none border-0"
              caption={`Invoices for ${activeChild?.fullName ?? 'this child'}`}
              data={invoices.data?.items}
              columns={invoiceColumns}
              rowKey={(row) => row.id}
              isLoading={invoices.isPending}
              error={invoices.error}
              onRetry={() => void invoices.refetch()}
              emptyIcon={<Wallet />}
              emptyTitle="No invoices yet"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              A payment is only shown once the school has confirmed it.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data-cy="family-finance-table-3"
              className="rounded-none border-0"
              caption={`Payments recorded for ${activeChild?.fullName ?? 'this child'}`}
              data={payments.data?.items}
              columns={paymentColumns}
              rowKey={(row) => row.id}
              isLoading={payments.isPending}
              error={payments.error}
              onRetry={() => void payments.refetch()}
              emptyIcon={<Receipt />}
              emptyTitle="No payments recorded yet"
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
