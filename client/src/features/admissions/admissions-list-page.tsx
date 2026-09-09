import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BadgeCheck, Plus } from 'lucide-react';
import { formatDate, formatPercent } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useLevels } from '@/features/academics/api';
import { useAdmissions, useAdmissionFunnel } from './api';
import type { AdmissionApplication } from '@/types/admissions';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { StatCard } from '@/components/data/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import { chartTheme } from '@/components/charts/chart-theme';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'OFFERED', label: 'Offered' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export function AdmissionsListPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['status', 'levelId'],
    defaultSortBy: 'submittedAt',
    defaultSortDir: 'desc',
  });
  const applications = useAdmissions(list.query);
  const funnel = useAdmissionFunnel();
  const levels = useLevels();

  const columns = useMemo<Column<AdmissionApplication>[]>(
    () => [
      {
        id: 'applicant',
        header: 'Applicant',
        cell: (application) => (
          <div className="min-w-0">
            <Link
              to={`/admissions/${application.id}`}
              className="block truncate font-medium text-foreground hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {[application.applicant.firstName, application.applicant.lastName].join(' ')}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{application.applicationNo}</p>
          </div>
        ),
      },
      {
        id: 'level',
        header: 'Applying for',
        cell: (application) => (
          <div className="min-w-0 text-sm">
            <p className="truncate">{application.levelName}</p>
            <p className="truncate text-xs text-muted-foreground">{application.sessionName}</p>
          </div>
        ),
      },
      {
        id: 'guardian',
        header: 'Guardian',
        hideOnMobile: true,
        cell: (application) => {
          const primary = application.guardians.find((g) => g.isPrimaryContact) ?? application.guardians[0];
          if (!primary) return '—';
          return (
            <div className="min-w-0 text-sm">
              <p className="truncate">
                {primary.firstName} {primary.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{primary.phone}</p>
            </div>
          );
        },
      },
      {
        id: 'submitted',
        header: 'Submitted',
        sortKey: 'submittedAt',
        hideOnMobile: true,
        cell: (application) => formatDate(application.submittedAt),
      },
      {
        id: 'score',
        header: 'Screening',
        align: 'center',
        hideOnMobile: true,
        cell: (application) =>
          application.screeningScore !== null && application.screeningScore !== undefined ? (
            <span className="tabular-nums">{application.screeningScore}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (application) => (
          <div className="space-y-1">
            <StatusBadge status={application.status} />
            {application.convertedStudentId && (
              <p className="text-xs text-success">Enrolled</p>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Admissions"
        description="Applications from enquiry to enrolment, with the conversion rate at each stage."
        breadcrumbs={[{ label: 'People' }, { label: 'Admissions' }]}
        actions={
          <PermissionGate require="admission.manage">
            <Button data-cy="admissions-list-new-application" asChild>
              <Link to="/admissions/new">
                <Plus />
                New application
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Applications"
          value={funnel.data?.received ?? 0}
          loading={funnel.isPending}
        />
        <StatCard
          label="Screened"
          value={funnel.data?.screened ?? 0}
          loading={funnel.isPending}
        />
        <StatCard label="Offered" value={funnel.data?.offered ?? 0} loading={funnel.isPending} />
        <StatCard
          label="Accepted"
          value={funnel.data?.accepted ?? 0}
          tone="success"
          loading={funnel.isPending}
        />
        <StatCard
          label="Conversion"
          value={funnel.data ? formatPercent(funnel.data.conversionRate) : '—'}
          hint="Offers that became enrolments"
          tone="primary"
          loading={funnel.isPending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications by level</CardTitle>
          <CardDescription>
            Where demand is, and where offers are not converting into enrolments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(funnel.data?.byLevel.length ?? 0) === 0 ? (
            <EmptyState compact icon={<BadgeCheck />} title="No applications yet this session" />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnel.data?.byLevel}
                  margin={{ top: 4, right: 8, left: -22, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="levelName" {...chartTheme.axis} />
                  <YAxis allowDecimals={false} {...chartTheme.axis} />
                  <ChartTooltip {...chartTheme.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="applications"
                    name="Applications"
                    fill={chartTheme.colors[1]}
                    fillOpacity={0.5}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="offered"
                    name="Offered"
                    fill={chartTheme.colors[0]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="accepted"
                    name="Accepted"
                    fill={chartTheme.colors[2]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by applicant name or application number…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          {
            key: 'levelId',
            label: 'Level',
            options: (levels.data ?? []).map((level) => ({ value: level.id, label: level.name })),
          },
        ]}
      />

      <DataTable

        data-cy="admissions-table"
        caption="Admission applications with applicant, level, guardian and current status"
        data={applications.data?.items}
        meta={applications.data?.meta}
        columns={columns}
        rowKey={(application) => application.id}
        isLoading={applications.isPending}
        isFetching={applications.isFetching}
        error={applications.error}
        onRetry={() => void applications.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={(application) => navigate(`/admissions/${application.id}`)}
        emptyIcon={<BadgeCheck />}
        emptyTitle={list.isFiltered ? 'No applications match those filters' : 'No applications yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Applications submitted through your website appear here, and you can enter walk-ins manually.'
        }
      />
    </PageContainer>
  );
}
