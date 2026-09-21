import { useCallback, useMemo, useState } from 'react';
import { Download, Lock, ScrollText } from 'lucide-react';
import { formatDateTime, formatRelative } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuditLog } from '@/features/settings/api';
import type { AuditLogEntry } from '@/types/engagement';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { SettingsTabs } from '@/features/settings/settings-tabs';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Avatar, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditDetailDialog } from './audit-page-parts';
import { RECORD_TYPE_OPTIONS } from './audit-filters';
import { SeverityBadge } from './audit-severity';
import {
  carriesMoney,
  describeAction,
  describeRecordType,
  describeRole,
} from './audit-labels';
import { buildRows, summarise } from './audit-values';

/**
 * The audit trail.
 *
 * Read-only by design: audit records are written by the operations they
 * describe and are never editable through the application API (spec section
 * 33). Everything sensitive — a published result changed, a payment recorded,
 * a role's permissions altered — lands here with the before and after values.
 */
export function AuditPage() {
  const list = useListQuery({
    filterKeys: ['severity', 'entityType'],
    defaultPageSize: 50,
  });
  const audit = useAuditLog(list.query);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const rows = useMemo(() => audit.data?.items ?? [], [audit.data]);

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (row: AuditLogEntry) => setSelected(row),
    [setSelected],
  );

  const columns = useMemo<Column<AuditLogEntry>[]>(
    () => [
      {
        id: 'action',
        header: 'Action',
        cell: (row) => (
          <div className="min-w-0">
            {/* The machine name stays one hover away, for anyone searching logs by it. */}
            <p className="truncate text-sm font-medium" title={row.action}>
              {describeAction(row.action)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {describeRecordType(row.entityType)}
              {row.entityLabel ? ` · ${row.entityLabel}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'actor',
        header: 'Who',
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.actorName} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-sm">{row.actorName}</p>
              <p className="truncate text-xs text-muted-foreground">{describeRole(row.actorRole)}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'severity',
        header: 'Severity',
        align: 'center',
        cell: (row) => <SeverityBadge severity={row.severity} />,
      },
      {
        id: 'when',
        header: 'When',
        align: 'right',
        cell: (row) => (
          <span title={formatDateTime(row.occurredAt)} className="whitespace-nowrap text-sm">
            {formatRelative(row.occurredAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Audit trail"
        description="Who changed what, and when. Records here cannot be edited or deleted from the app."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Audit trail' }]}
        actions={
          <Button
            data-cy="audit-export-page"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              void exportRowsToXlsx(
                `audit-${new Date().toISOString().slice(0, 10)}.xlsx`,
                rows.map((row) => ({
                  When: formatDateTime(row.occurredAt),
                  Actor: row.actorName,
                  Role: describeRole(row.actorRole),
                  Action: describeAction(row.action),
                  'Record type': describeRecordType(row.entityType),
                  Record: row.entityLabel ?? row.references?.[row.entityId]?.label ?? '',
                  // What was recorded, in words — the names, not the ids behind them.
                  Details: summarise(
                    buildRows(row.before, row.after, {
                      references: row.references,
                      money: carriesMoney(row.entityType),
                    }),
                  ),
                  Severity: row.severity,
                  'IP address': row.ipAddress ?? '',
                  'Action code': row.action,
                  'Record id': row.entityId,
                  'Request id': row.requestId ?? '',
                })),
                { sheetName: 'Audit trail' },
              )
            }
          >
            <Download />
            Export page
          </Button>
        }
      />

      <SettingsTabs />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by person, action or record…"
        isSearching={list.isSearchPending || audit.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          {
            key: 'severity',
            label: 'Severity',
            allLabel: 'All severities',
            options: [
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'INFO', label: 'Info' },
            ],
          },
          {
            key: 'entityType',
            label: 'Record type',
            allLabel: 'All record types',
            options: RECORD_TYPE_OPTIONS,
          },
        ]}
      />

      <DataTable

        data-cy="audit-table"
        caption="Audited changes to sensitive records"
        data={rows}
        meta={audit.data?.meta}
        columns={columns}
        rowKey={(row) => row.id}
        isLoading={audit.isPending}
        isFetching={audit.isFetching}
        error={audit.error}
        onRetry={() => void audit.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={handleRowClick}
        emptyIcon={<ScrollText />}
        emptyTitle="Nothing audited yet"
        emptyDescription="Sensitive changes — published results, payments, role edits — appear here as they happen."
      />

      <Card>
        <CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Audit records are append-only. They are written by the operations they describe, and no
            role — including yours — can amend or remove them through this application.
          </p>
        </CardContent>
      </Card>

      <AuditDetailDialog entry={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </PageContainer>
  );
}
