import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Button } from '@/components/ui/button';
import type { DocumentDelivery } from '@/types/finance';
import {
  CHANNEL_LABEL,
  ChannelIcon,
  DOCUMENT_TYPE_LABEL,
  DeliveryStatusBadge,
  PRINT_FORMAT_LABEL,
} from './document-delivery-log';
import { useConfirmDeliveryFromRegister, useDeliveries } from './use-document-deliveries';

const TYPE_OPTIONS = [
  { value: 'RECEIPT', label: 'Receipts' },
  { value: 'INVOICE', label: 'Invoices' },
  { value: 'BILL', label: 'Bills' },
  { value: 'FEE_SCHEDULE', label: 'Fee schedules' },
];

const CHANNEL_OPTIONS = [
  { value: 'PRINT', label: 'Printed' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'OTHER', label: 'Another way' },
];

/** Only narrows prints; a register filtered to POS answers "who only ever got a till slip?". */
const PRINT_FORMAT_OPTIONS = [
  { value: 'POS', label: 'POS slip (78mm)' },
  { value: 'FULL_PAGE', label: 'Full page' },
];

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Delivered' },
  { value: 'PREPARED', label: 'Not confirmed' },
  { value: 'FAILED', label: 'Failed' },
];

/** Where a row's document lives, so the register can link back to it. */
function documentHref(delivery: DocumentDelivery): string | null {
  if (delivery.documentType === 'RECEIPT') return `/finance/receipts/${delivery.documentId}`;
  if (delivery.documentType === 'INVOICE') return `/finance/invoices/${delivery.documentId}`;
  // A bill and a fee schedule are printed from screens that take no id in the
  // same way; the register still names them, it just does not link.
  return null;
}

/**
 * Everything this school has sent out, in one place.
 *
 * The question this page exists for is not "what happened?" — the audit trail
 * answers that, across two hundred kinds of action — but "what has actually
 * reached families, and what has not?". So the filters are the ones the office
 * works from: the channel, whether anybody has confirmed it, and when.
 *
 * "Not confirmed" is the filter that earns the page. A print or a WhatsApp
 * message is only ever recorded as prepared, because nothing in this system can
 * see paper come out of a printer or a person press Send — so this list, filtered
 * that way, is the day's work: the copies somebody still has to vouch for.
 */
export function DeliveriesPage() {
  const list = useListQuery({
    filterKeys: ['documentType', 'channel', 'printFormat', 'status', 'dateFrom', 'dateTo'],
    defaultSortBy: 'sentAt',
    defaultSortDir: 'desc',
  });
  const deliveries = useDeliveries({ ...list.query, ...list.filters });
  const confirm = useConfirmDeliveryFromRegister();

  const columns = useMemo<Column<DocumentDelivery>[]>(
    () => [
      {
        id: 'document',
        header: 'Document',
        sortKey: 'documentLabel',
        cell: (delivery) => {
          const href = documentHref(delivery);
          return (
            <div className="min-w-0">
              {href ? (
                <Link
                  to={href}
                  className="block truncate font-medium hover:text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {delivery.documentLabel}
                </Link>
              ) : (
                <p className="truncate font-medium">{delivery.documentLabel}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABEL[delivery.documentType]}
              </p>
            </div>
          );
        },
      },
      {
        id: 'student',
        header: 'Student',
        sortKey: 'studentName',
        cell: (delivery) =>
          delivery.studentName ? (
            <p className="truncate">{delivery.studentName}</p>
          ) : (
            // A fee schedule goes to a cohort and a custom bill to an outside
            // payer; neither has a child to name, and an empty cell would read
            // as missing data.
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'channel',
        header: 'Sent by',
        cell: (delivery) => (
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5">
              <ChannelIcon channel={delivery.channel} />
            </span>
            <div className="min-w-0">
              <p className="truncate">
                {CHANNEL_LABEL[delivery.channel]}
                {/* A till slip and a filed document are not the same thing to a
                    family, so the register never just says "Printed". */}
                {delivery.printFormat && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {PRINT_FORMAT_LABEL[delivery.printFormat]}
                  </span>
                )}
              </p>
              {delivery.recipientName && (
                <p className="truncate text-xs text-muted-foreground">
                  {delivery.recipientName}
                  {delivery.recipientContact ? ` · ${delivery.recipientContact}` : ''}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'sent',
        header: 'When',
        sortKey: 'sentAt',
        hideOnMobile: true,
        cell: (delivery) => (
          <div className="min-w-0">
            <p className="truncate">{formatDateTime(delivery.sentAt)}</p>
            <p className="truncate text-xs text-muted-foreground">by {delivery.sentByName}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (delivery) => (
          <div className="space-y-1">
            <DeliveryStatusBadge status={delivery.status} />
            {delivery.status === 'FAILED' && delivery.failureReason && (
              <p
                className="max-w-[14rem] truncate text-xs text-muted-foreground"
                title={delivery.failureReason}
              >
                {delivery.failureReason}
              </p>
            )}
            {delivery.confirmedByName && (
              <p className="truncate text-xs text-muted-foreground">
                by {delivery.confirmedByName}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (delivery) =>
          delivery.status === 'PREPARED' ? (
            <Button
              data-cy="deliveries-confirm"
              variant="ghost"
              size="sm"
              loading={confirm.isPending && confirm.variables === delivery.id}
              onClick={(event) => {
                event.stopPropagation();
                confirm.mutate(delivery.id);
              }}
            >
              <Check />
              Mark delivered
            </Button>
          ) : null,
      },
    ],
    [confirm],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Documents sent"
        description="Every receipt, invoice, bill and fee schedule this school has sent out — printed, emailed or shared on WhatsApp."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Documents sent' }]}
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by number, student or recipient…"
        isSearching={deliveries.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        dateRange={{
          label: 'Sent',
          fromKey: 'dateFrom',
          toKey: 'dateTo',
          onChange: list.setFilters,
        }}
        filters={[
          {
            key: 'documentType',
            label: 'Document',
            options: TYPE_OPTIONS,
            allLabel: 'Every document',
          },
          { key: 'channel', label: 'Channel', options: CHANNEL_OPTIONS, allLabel: 'Every channel' },
          {
            key: 'printFormat',
            label: 'Paper',
            options: PRINT_FORMAT_OPTIONS,
            allLabel: 'Any paper',
          },
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'Any status' },
        ]}
      />

      <DataTable
        data-cy="deliveries-table"
        caption="Finance documents sent to families, with channel, recipient and whether delivery is confirmed"
        data={deliveries.data?.items}
        meta={deliveries.data?.meta}
        columns={columns}
        rowKey={(delivery) => delivery.id}
        isLoading={deliveries.isPending}
        isFetching={deliveries.isFetching}
        error={deliveries.error}
        onRetry={() => void deliveries.refetch()}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyIcon={<Send />}
        emptyTitle={list.isFiltered ? 'Nothing matches that filter' : 'Nothing has gone out yet'}
        emptyDescription="Receipts, invoices and bills appear here as they are printed, emailed or shared."
      />
    </PageContainer>
  );
}
