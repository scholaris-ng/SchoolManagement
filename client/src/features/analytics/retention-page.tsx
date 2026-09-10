import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Download,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatRelative } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useListQuery } from '@/hooks/use-list-query';
import { useSchool } from '@/features/settings/api';
import { useRetentionRisk } from './api';
import type { RetentionRiskRow } from '@/types/analytics';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatCard } from '@/components/data/stat-card';
import { Badge, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { BAND_TONE } from './retention-page-constants';
import { RiskDetailDialog } from './retention-page-parts';



/**
 * Withdrawal risk.
 *
 * A family rarely leaves without warning: arrears build, attendance slips, an
 * invoice goes past its due date and the guardian stops signing in. The score
 * is computed server-side from those four signals so a bursar can have the
 * conversation while it is still a conversation, not an exit interview.
 *
 * This is a prompt to reach out — never a reason to withhold a child's
 * education — so the screen leads with the signals rather than the number.
 */
export function RetentionPage() {
  const list = useListQuery({
    filterKeys: ['riskBand'],
    defaultPageSize: 25,
  });
  const risk = useRetentionRisk(list.query);
  const school = useSchool();
  const currency = school.data?.settings.currency ?? 'NGN';

  const [selected, setSelected] = useState<RetentionRiskRow | null>(null);

  const rows = useMemo(() => risk.data?.items ?? [], [risk.data]);
  const highCount = rows.filter((row) => row.riskBand === 'HIGH').length;
  const mediumCount = rows.filter((row) => row.riskBand === 'MEDIUM').length;

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (row: RetentionRiskRow) => setSelected(row),
    [setSelected],
  );

  const columns = useMemo<Column<RetentionRiskRow>[]>(
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
        id: 'band',
        header: 'Risk',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Badge tone={BAND_TONE[row.riskBand]}>{row.riskBand}</Badge>
            <Progress
              value={row.riskScore}
              tone={BAND_TONE[row.riskBand] === 'success' ? 'success' : BAND_TONE[row.riskBand]}
              className="hidden min-w-[6rem] xl:flex"
            />
            <span className="tabular-nums text-xs text-muted-foreground">{row.riskScore}</span>
          </div>
        ),
      },
      {
        id: 'signals',
        header: 'Why',
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.signals.map((signal) => (
              <Badge key={signal.key} tone="outline" className="font-normal">
                {signal.label}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'balance',
        header: 'Owing',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span
            className={cn(
              'tabular-nums',
              row.outstandingBalance > 0 ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {formatCurrency(row.outstandingBalance, currency, { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'attendance',
        header: 'Attendance',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums">{formatPercent(row.attendanceRate, 0)}</span>
        ),
      },
      {
        id: 'engagement',
        header: 'Guardian last seen',
        hideOnMobile: true,
        cell: (row) =>
          row.guardianLastLoginAt ? (
            formatRelative(row.guardianLastLoginAt)
          ) : (
            <span className="text-muted-foreground">Never signed in</span>
          ),
      },
    ],
    [currency],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Retention risk"
        description="Families showing the early signs of leaving, ranked so the most urgent conversation is at the top."
        breadcrumbs={[{ label: 'Overview' }, { label: 'Retention risk' }]}
        actions={
          <Button
            data-cy="analytics-retention-export-list"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              void exportRowsToXlsx(
                `retention-risk-${new Date().toISOString().slice(0, 10)}.xlsx`,
                rows.map((row) => ({
                  Student: row.studentName,
                  'Admission no': row.admissionNo,
                  Class: row.className ?? '',
                  'Risk band': row.riskBand,
                  'Risk score': row.riskScore,
                  Signals: row.signals.map((signal) => signal.label).join('; '),
                  Outstanding: row.outstandingBalance,
                  'Attendance rate': row.attendanceRate,
                  'Guardian last login': row.guardianLastLoginAt ?? 'never',
                })),
                { sheetName: 'Retention risk' },
              )
            }
          >
            <Download />
            Export list
          </Button>
        }
      />

      <Alert
        tone="info"
        title="How to use this"
        icon={<ShieldCheck />}
      >
        These are prompts to make contact — a payment plan, a call about attendance, an invitation
        to a meeting. Nothing here should be used to exclude a child or shared beyond the staff who
        need it.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="High risk"
          value={highCount}
          tone="danger"
          icon={<TriangleAlert />}
          hint="Reach out this week"
          loading={risk.isPending}
        />
        <StatCard
          label="Medium risk"
          value={mediumCount}
          tone="warning"
          icon={<Activity />}
          hint="Worth watching"
          loading={risk.isPending}
        />
        <StatCard
          label="Flagged in total"
          value={risk.data?.meta.total ?? 0}
          icon={<Activity />}
          loading={risk.isPending}
        />
      </div>

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by student name or admission number…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          {
            key: 'riskBand',
            label: 'Risk band',
            allLabel: 'All risk bands',
            options: [
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ],
          },
        ]}
      />

      <DataTable

        data-cy="analytics-retention-table"
        caption="Students whose families show early signs of withdrawing"
        data={rows}
        meta={risk.data?.meta}
        columns={columns}
        rowKey={(row) => row.studentId}
        isLoading={risk.isPending}
        isFetching={risk.isFetching}
        error={risk.error}
        onRetry={() => void risk.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={handleRowClick}
        emptyIcon={<ShieldCheck />}
        emptyTitle="No families are showing warning signs"
        emptyDescription="Attendance, fee balances and guardian engagement all look healthy."
      />

      <RiskDetailDialog
        row={selected}
        currency={currency}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </PageContainer>
  );
}
