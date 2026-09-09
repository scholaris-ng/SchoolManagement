import { useMemo, useState } from 'react';
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
import { Avatar, Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SEVERITY_TONE = {
  INFO: 'neutral',
  WARNING: 'warning',
  CRITICAL: 'danger',
} as const;

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

  const columns = useMemo<Column<AuditLogEntry>[]>(
    () => [
      {
        id: 'action',
        header: 'Action',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-medium">{row.action}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.entityType}
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
              <p className="truncate text-xs text-muted-foreground">{row.actorRole}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'severity',
        header: 'Severity',
        align: 'center',
        cell: (row) => <Badge tone={SEVERITY_TONE[row.severity]}>{row.severity}</Badge>,
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
                  When: row.occurredAt,
                  Actor: row.actorName,
                  Role: row.actorRole,
                  Action: row.action,
                  'Entity type': row.entityType,
                  'Entity id': row.entityId,
                  Entity: row.entityLabel ?? '',
                  Severity: row.severity,
                  'IP address': row.ipAddress ?? '',
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
            options: [
              { value: 'Student', label: 'Student' },
              { value: 'ScoreSheet', label: 'Score sheet' },
              { value: 'Invoice', label: 'Invoice' },
              { value: 'Payment', label: 'Payment' },
              { value: 'Role', label: 'Role' },
              { value: 'Admission', label: 'Admission' },
              { value: 'DisciplineIncident', label: 'Discipline' },
            ],
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
        onRowClick={(row) => setSelected(row)}
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

function AuditDetailDialog({
  entry,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{entry.action}</DialogTitle>
              <DialogDescription>
                {entry.actorName} ({entry.actorRole}) · {formatDateTime(entry.occurredAt)}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Record" value={`${entry.entityType} · ${entry.entityId}`} />
                <Detail label="Label" value={entry.entityLabel ?? '—'} />
                <Detail label="Severity" value={entry.severity} />
                <Detail label="IP address" value={entry.ipAddress ?? 'Not recorded'} />
                <Detail label="Request id" value={entry.requestId ?? 'Not recorded'} />
                <Detail label="User agent" value={entry.userAgent ?? 'Not recorded'} />
              </dl>

              <div className="grid gap-3 lg:grid-cols-2">
                <ChangeBlock title="Before" value={entry.before} />
                <ChangeBlock title="After" value={entry.after} />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button data-cy="audit-close" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{value}</dd>
    </div>
  );
}

function ChangeBlock({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null | undefined;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {value === null || value === undefined ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Not recorded
        </p>
      ) : (
        <pre className="scrollbar-thin max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
          <code>{JSON.stringify(value, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}
