import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useListQuery } from '@/hooks/use-list-query';
import { useClasses, useTerms } from '@/features/academics/api';
import { useInvoices } from './api';
import type { Invoice } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

const STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PART_PAID', label: 'Part paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function InvoicesPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['status', 'termId', 'classId'],
    defaultSortBy: 'issueDate',
    defaultSortDir: 'desc',
  });
  const invoices = useInvoices(list.query);
  const terms = useTerms();
  const classes = useClasses();

  const currency = 'NGN';

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (invoice: Invoice) => navigate(`/finance/invoices/${invoice.id}`),
    [navigate],
  );

  const columns = useMemo<Column<Invoice>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        sortKey: 'invoiceNo',
        cell: (invoice) => (
          <div className="min-w-0">
            <Link
              to={`/finance/invoices/${invoice.id}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {invoice.invoiceNo}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {invoice.termName} · {invoice.sessionName}
            </p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        cell: (invoice) => (
          <div className="min-w-0">
            <p className="truncate">{invoice.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {invoice.admissionNo}
              {invoice.className ? ` · ${invoice.className}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'due',
        header: 'Due',
        sortKey: 'dueDate',
        hideOnMobile: true,
        cell: (invoice) => formatDate(invoice.dueDate),
      },
      {
        id: 'total',
        header: 'Total',
        align: 'right',
        sortKey: 'total',
        cell: (invoice) => (
          <span className="tabular-nums">
            {formatCurrency(invoice.total, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'paid',
        header: 'Paid',
        align: 'right',
        hideOnMobile: true,
        cell: (invoice) => (
          <span className="tabular-nums text-success">
            {formatCurrency(invoice.amountPaid, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        align: 'right',
        sortKey: 'balance',
        cell: (invoice) => (
          <span
            className={`tabular-nums ${invoice.balance > 0 ? 'font-medium text-danger' : 'text-muted-foreground'}`}
          >
            {formatCurrency(invoice.balance, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (invoice) => <StatusBadge status={invoice.status} />,
      },
    ],
    [],
  );

  const exportInvoices = () => {
    void exportRowsToXlsx(
      `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`,
      (invoices.data?.items ?? []).map((invoice) => ({
        Invoice: invoice.invoiceNo,
        Student: invoice.studentName,
        'Admission no': invoice.admissionNo,
        Class: invoice.className ?? '',
        Term: invoice.termName,
        Issued: invoice.issueDate,
        Due: invoice.dueDate,
        Total: invoice.total,
        Paid: invoice.amountPaid,
        Balance: invoice.balance,
        Status: invoice.status,
      })),
      { sheetName: 'Invoices' },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="What each family has been billed, and what is still owed."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]}
        actions={
          <>
            <Button data-cy="finance-invoices-export" variant="outline" onClick={exportInvoices}>
              <Download />
              Export
            </Button>
            <PermissionGate require="invoice.manage">
              <Button data-cy="finance-invoices-new-invoice" asChild>
                <Link to="/finance/invoices/new">
                  <Plus />
                  New invoice
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by invoice number, student or admission number…"
        isSearching={list.isSearchPending || invoices.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          {
            key: 'termId',
            label: 'Term',
            options: (terms.data ?? []).map((term) => ({
              value: term.id,
              label: `${term.name} · ${term.sessionName}`,
            })),
          },
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          },
        ]}
      />

      <DataTable

        data-cy="finance-invoices-table"
        caption="Invoices with student, term, amount billed, amount paid and balance"
        data={invoices.data?.items}
        meta={invoices.data?.meta}
        columns={columns}
        rowKey={(invoice) => invoice.id}
        isLoading={invoices.isPending}
        isFetching={invoices.isFetching}
        error={invoices.error}
        onRetry={() => void invoices.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={handleRowClick}
        emptyIcon={<Receipt />}
        emptyTitle={list.isFiltered ? 'No invoices match those filters' : 'No invoices yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Create a fee structure, then issue invoices for the term.'
        }
      />
    </PageContainer>
  );
}
