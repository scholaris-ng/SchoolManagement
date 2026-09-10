import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Download, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useListQuery } from '@/hooks/use-list-query';
import { useClasses } from '@/features/academics/api';
import { useDebtors } from './api';
import type { StudentFinanceSummary } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

/**
 * Who owes what.
 *
 * Sorted by balance so the conversation that recovers the most money is at the
 * top, with a direct route into recording the payment when it arrives.
 */
export function DebtorsPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['classId', 'overdueOnly'],
    defaultSortBy: 'balance',
    defaultSortDir: 'desc',
  });
  const debtors = useDebtors(list.query);
  const classes = useClasses();

  const currency = 'NGN';

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (row: StudentFinanceSummary) => navigate(`/students/${row.studentId}`),
    [navigate],
  );

  const columns = useMemo<Column<StudentFinanceSummary>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        cell: (row) => (
          <div className="min-w-0">
            <Link
              to={`/students/${row.studentId}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.studentName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {row.admissionNo}
              {row.className ? ` · ${row.className}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'billed',
        header: 'Billed',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums">
            {formatCurrency(row.totalBilled, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'paid',
        header: 'Paid',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-success">
            {formatCurrency(row.totalPaid, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Owing',
        align: 'right',
        sortKey: 'balance',
        cell: (row) => (
          <span className="font-medium tabular-nums text-danger">
            {formatCurrency(row.balance, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'overdue',
        header: 'Overdue invoices',
        align: 'center',
        cell: (row) =>
          row.overdueInvoices > 0 ? (
            <Badge tone="danger">{row.overdueInvoices}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'last',
        header: 'Last payment',
        hideOnMobile: true,
        cell: (row) =>
          row.lastPaymentAt ? (
            formatDate(row.lastPaymentAt)
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <PermissionGate require="payment.manage">
            <Button data-cy="finance-debtors-event-stoppropagation-record-payment" variant="ghost" size="sm" asChild>
              <Link
                to={`/finance/payments/new?studentId=${row.studentId}`}
                onClick={(event) => event.stopPropagation()}
              >
                <CreditCard />
                Record payment
              </Link>
            </Button>
          </PermissionGate>
        ),
      },
    ],
    [],
  );

  const exportDebtors = () => {
    void exportRowsToXlsx(
      `debtors-${new Date().toISOString().slice(0, 10)}.xlsx`,
      (debtors.data?.items ?? []).map((row) => ({
        Student: row.studentName,
        'Admission no': row.admissionNo,
        Class: row.className ?? '',
        Billed: row.totalBilled,
        Paid: row.totalPaid,
        Discount: row.totalDiscount,
        Balance: row.balance,
        'Overdue invoices': row.overdueInvoices,
        'Last payment': row.lastPaymentAt ?? '',
      })),
      { sheetName: 'Debtors' },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Debtors"
        description="Families with an outstanding balance, largest first."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Debtors' }]}
        actions={
          <Button data-cy="finance-debtors-export-list" variant="outline" onClick={exportDebtors}>
            <Download />
            Export list
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by student name or admission number…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          },
          {
            key: 'overdueOnly',
            label: 'Overdue',
            options: [{ value: 'true', label: 'Overdue only' }],
            allLabel: 'All debtors',
          },
        ]}
      />

      <DataTable

        data-cy="finance-debtors-table"
        caption="Students with an outstanding fee balance"
        data={debtors.data?.items}
        meta={debtors.data?.meta}
        columns={columns}
        rowKey={(row) => row.studentId}
        isLoading={debtors.isPending}
        isFetching={debtors.isFetching}
        error={debtors.error}
        onRetry={() => void debtors.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={handleRowClick}
        emptyIcon={<Wallet />}
        emptyTitle="Every account is settled"
        emptyDescription="No family currently owes the school anything."
      />
    </PageContainer>
  );
}
