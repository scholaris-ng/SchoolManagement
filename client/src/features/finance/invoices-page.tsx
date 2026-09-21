import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, Receipt, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useTerms } from '@/features/academics/api';
import { useDeleteInvoices, useExportInvoices, useInvoices } from './api';
import type { Invoice } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar, SelectionBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
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
  const { can } = useAuth();
  const list = useListQuery({
    filterKeys: ['status', 'termId', 'classId', 'dateFrom', 'dateTo'],
    defaultSortBy: 'issueDate',
    defaultSortDir: 'desc',
  });
  const invoices = useInvoices(list.query);
  const exportInvoices = useExportInvoices();
  const terms = useTerms();
  const classes = useClasses();
  const deleteInvoices = useDeleteInvoices();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const canManage = can('invoice.manage');

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

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="What each family has been billed, and what is still owed."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]}
        actions={
          <>
            <Button
              data-cy="finance-invoices-export"
              variant="outline"
              loading={exportInvoices.isPending}
              loadingLabel="Exporting…"
              // Everything the filters match, dates included — not just this page.
              onClick={() => exportInvoices.mutate(list.query)}
            >
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
        dateRange={{
          label: 'Issued',
          fromKey: 'dateFrom',
          toKey: 'dateTo',
          onChange: list.setFilters,
        }}
      />

      <SelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button
          data-cy="finance-invoices-delete-selected"
          variant="outline"
          size="sm"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 />
          Delete selected
        </Button>
      </SelectionBar>

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
        selectedIds={canManage ? selectedIds : undefined}
        onSelectionChange={canManage ? setSelectedIds : undefined}
        onRowClick={handleRowClick}
        emptyIcon={<Receipt />}
        emptyTitle={list.isFiltered ? 'No invoices match those filters' : 'No invoices yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Create a fee structure, then issue invoices for the term.'
        }
      />

      <ConfirmDialog
        data-cy="finance-invoices-delete-confirm"
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title={
          selectedIds.length === 1
            ? 'Delete this invoice?'
            : `Delete ${selectedIds.length} invoices?`
        }
        description="This removes the invoice entirely rather than just cancelling it, so it is refused for any invoice that already has a payment recorded against it, or that carries a balance to or from another invoice. Anything else selected is removed for good."
        confirmLabel="Delete"
        loading={deleteInvoices.isPending}
        onConfirm={async () => {
          await deleteInvoices.mutateAsync(selectedIds);
          setSelectedIds([]);
          setDeleteConfirmOpen(false);
        }}
      />
    </PageContainer>
  );
}
