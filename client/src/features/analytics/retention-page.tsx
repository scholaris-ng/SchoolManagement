import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarClock,
  Download,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  Wallet,
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
import { Badge, Card, CardContent, Progress } from '@/components/ui/primitives';
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
import { Alert } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

const BAND_TONE = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'success',
} as const;

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
        onRowClick={(row) => setSelected(row)}
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

function RiskDetailDialog({
  row,
  currency,
  onOpenChange,
}: {
  row: RetentionRiskRow | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent>
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{row.studentName}</DialogTitle>
              <DialogDescription>
                {row.className ?? 'No class'} · {row.admissionNo} · scored {row.riskScore} out of 100
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge tone={BAND_TONE[row.riskBand]}>{row.riskBand} risk</Badge>
                <Progress
                  value={row.riskScore}
                  tone={BAND_TONE[row.riskBand] === 'success' ? 'success' : BAND_TONE[row.riskBand]}
                  showLabel
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">What triggered this</p>
                {row.signals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active signals.</p>
                ) : (
                  <ul className="space-y-2">
                    {row.signals.map((signal) => (
                      <li
                        key={signal.key}
                        className="flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                          {signal.key === 'arrears' || signal.key === 'overdue' ? (
                            <Wallet className="size-4" />
                          ) : signal.key === 'attendance' ? (
                            <CalendarClock className="size-4" />
                          ) : (
                            <MessageSquare className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{signal.label}</p>
                          <p className="text-xs text-muted-foreground">{signal.detail}</p>
                        </div>
                        <Badge tone="neutral">+{signal.weight}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Card>
                <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
                  <Figure
                    label="Outstanding"
                    value={formatCurrency(row.outstandingBalance, currency, {
                      showDecimals: false,
                    })}
                  />
                  <Figure label="Attendance" value={formatPercent(row.attendanceRate, 0)} />
                  <Figure
                    label="Guardian last seen"
                    value={
                      row.guardianLastLoginAt ? formatRelative(row.guardianLastLoginAt) : 'Never'
                    }
                  />
                </CardContent>
              </Card>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" asChild>
                <Link to={`/students/${row.studentId}`}>Open student</Link>
              </Button>
              <PermissionGate require="message.send">
                <Button asChild>
                  <Link to={`/messages?studentId=${row.studentId}`}>
                    <MessageSquare />
                    Message the family
                  </Link>
                </Button>
              </PermissionGate>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
