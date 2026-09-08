import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  ClipboardCheck,
  Download,
  GraduationCap,
  ScrollText,
  UserCog,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useAuth } from '@/app/providers/auth-provider';
import { useCurrentTerm, useTermOptions } from '@/features/academics/api';
import { useResultAnalytics } from '@/features/results/api';
import { useAttendanceSummary, type ClassAttendanceSummaryRow } from '@/features/attendance/api';
import { useFinanceOverview } from '@/features/finance/api';
import { useAdmissionFunnel } from '@/features/admissions/api';
import { useStaffPerformance } from '@/features/staff/api';
import type { StaffPerformanceRow, SubjectPerformanceRow } from '@/types/analytics';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { TabPanel, TabStrip, useTabState, type TabDefinition } from '@/components/layout/tab-strip';
import { StatCard } from '@/components/data/stat-card';
import { DataTable, type Column } from '@/components/data/data-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme, gradeColor } from '@/components/charts/chart-theme';

/**
 * Management analytics.
 *
 * Every figure here is aggregated by the API — the browser asks one question
 * per panel and never pages through thousands of rows to add them up (spec
 * sections 32 and 43). Each tab is a separate query, so opening the page on a
 * phone fetches the academic summary and nothing else.
 */
export function AnalyticsPage() {
  const { can } = useAuth();
  const currentTerm = useCurrentTerm();
  const termOptions = useTermOptions();
  const [termId, setTermId] = useTermSelection(currentTerm.data?.id);

  const tabs = useMemo<TabDefinition[]>(() => {
    const all: (TabDefinition | null)[] = [
      { id: 'academic', label: 'Academic', icon: ScrollText },
      { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
      { id: 'finance', label: 'Finance', icon: Wallet },
      { id: 'admissions', label: 'Admissions', icon: BadgeCheck },
      can('analytics.staff') ? { id: 'staff', label: 'Staff', icon: UserCog } : null,
    ];
    return all.filter((tab): tab is TabDefinition => tab !== null);
  }, [can]);

  const { activeId, setActive } = useTabState(tabs);

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="How the school is performing this term, across teaching, attendance, money and admissions."
        breadcrumbs={[{ label: 'Overview' }, { label: 'Analytics' }]}
        actions={
          <NativeSelect
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
            aria-label="Term"
            className="h-9 w-auto min-w-[12rem]"
          >
            {termOptions.length === 0 && <option value="">Current term</option>}
            {termOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />

      <TabStrip tabs={tabs} activeId={activeId} onChange={setActive} label="Analytics sections" />

      <TabPanel tabId={activeId}>
        {activeId === 'academic' && <AcademicPanel termId={termId} />}
        {activeId === 'attendance' && <AttendancePanel />}
        {activeId === 'finance' && <FinancePanel termId={termId} />}
        {activeId === 'admissions' && <AdmissionsPanel />}
        {activeId === 'staff' && <StaffPanel termId={termId} />}
      </TabPanel>
    </PageContainer>
  );
}

/**
 * The chosen term lives in the URL alongside the tab, so "the finance view for
 * last term" is a link somebody can send to the principal.
 */
function useTermSelection(currentTermId: string | undefined): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') ?? currentTermId ?? '';

  const setTermId = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === currentTermId) next.delete('termId');
        else next.set('termId', value);
        return next;
      },
      { replace: true },
    );

  return [termId, setTermId];
}

/* -------------------------------------------------------------------------- */
/* Academic                                                                    */
/* -------------------------------------------------------------------------- */

function AcademicPanel({ termId }: { termId: string }) {
  const analytics = useResultAnalytics(termId || undefined);
  const data = analytics.data;

  const columns = useMemo<Column<SubjectPerformanceRow>[]>(
    () => [
      {
        id: 'subject',
        header: 'Subject',
        cell: (row) => <span className="font-medium">{row.subjectName}</span>,
      },
      {
        id: 'average',
        header: 'Average',
        align: 'right',
        cell: (row) => <span className="tabular-nums">{row.averageScore.toFixed(1)}</span>,
      },
      {
        id: 'pass',
        header: 'Pass rate',
        cell: (row) => (
          <Progress
            value={row.passRate}
            showLabel
            tone={row.passRate >= 70 ? 'success' : row.passRate >= 50 ? 'warning' : 'danger'}
            className="min-w-[8rem]"
          />
        ),
      },
      {
        id: 'assessed',
        header: 'Assessed',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{formatNumber(row.studentsAssessed)}</span>,
      },
      {
        id: 'range',
        header: 'Range',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {row.lowest}&ndash;{row.highest}
          </span>
        ),
      },
    ],
    [],
  );

  if (analytics.isError) {
    return <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />;
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analytics.isPending ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Overall average"
              value={data ? `${data.overallAverage.toFixed(1)}%` : '—'}
              hint={data?.termName}
              icon={<ScrollText />}
            />
            <StatCard
              label="Pass rate"
              value={formatPercent(data?.passRate ?? 0)}
              tone={(data?.passRate ?? 0) >= 70 ? 'success' : 'warning'}
              icon={<GraduationCap />}
            />
            <StatCard
              label="Subjects assessed"
              value={data?.subjects.length ?? 0}
              icon={<ScrollText />}
            />
            <StatCard
              label="Weakest subject"
              value={data?.subjects[0]?.subjectName ?? '—'}
              hint={
                data?.subjects[0] ? `${data.subjects[0].averageScore.toFixed(1)}% average` : undefined
              }
              tone="warning"
              icon={<Activity />}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grade distribution</CardTitle>
            <CardDescription>
              How the school landed against your own grading bands.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isPending ? (
              <LoadingState label="Loading grades…" />
            ) : (data?.gradeDistribution.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<ScrollText />}
                title="No published results yet"
                description="Grades appear once a score sheet has been approved."
              />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.gradeDistribution}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="grade" {...chartTheme.axis} />
                    <YAxis allowDecimals={false} {...chartTheme.axis} />
                    <ChartTooltip {...chartTheme.tooltip} />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {(data?.gradeDistribution ?? []).map((band) => (
                        <Cell key={band.grade} fill={band.color ?? gradeColor(band.grade)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class comparison</CardTitle>
            <CardDescription>Average and pass rate per class.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isPending ? (
              <LoadingState label="Loading classes…" />
            ) : (data?.classComparison.length ?? 0) === 0 ? (
              <EmptyState compact icon={<GraduationCap />} title="No class results yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.classComparison}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="className" {...chartTheme.axis} />
                    <YAxis domain={[0, 100]} {...chartTheme.axis} />
                    <ChartTooltip {...chartTheme.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="average"
                      name="Average"
                      fill={chartTheme.colors[0]}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="passRate"
                      name="Pass rate"
                      fill={chartTheme.colors[2]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DataTable
        caption="Average score and pass rate for each subject"
        data={data?.subjects}
        columns={columns}
        rowKey={(row) => row.subjectId}
        isLoading={analytics.isPending}
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
        emptyIcon={<ScrollText />}
        emptyTitle="No subject results yet"
        emptyDescription="Once teachers submit score sheets, the weakest subjects appear at the top."
        toolbar={
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Subject performance</p>
            <Button
              variant="outline"
              size="sm"
              disabled={(data?.subjects.length ?? 0) === 0}
              onClick={() =>
                void exportRowsToXlsx(
                  `subject-performance-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  (data?.subjects ?? []).map((row) => ({
                    Subject: row.subjectName,
                    Average: row.averageScore,
                    'Pass rate': row.passRate,
                    'Students assessed': row.studentsAssessed,
                    Highest: row.highest,
                    Lowest: row.lowest,
                  })),
                  { sheetName: 'Subject performance' },
                )
              }
            >
              <Download />
              Export
            </Button>
          </div>
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                  */
/* -------------------------------------------------------------------------- */

function AttendancePanel() {
  const summary = useAttendanceSummary();
  const rows = useMemo(() => summary.data ?? [], [summary.data]);

  const schoolRate = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + row.attendanceRate, 0) / rows.length) * 10) / 10
    : 0;

  const columns = useMemo<Column<ClassAttendanceSummaryRow>[]>(
    () => [
      {
        id: 'class',
        header: 'Class',
        cell: (row) => <span className="font-medium">{row.className}</span>,
      },
      {
        id: 'rate',
        header: 'Attendance rate',
        cell: (row) => (
          <Progress
            value={row.attendanceRate}
            showLabel
            tone={
              row.attendanceRate >= 92 ? 'success' : row.attendanceRate >= 85 ? 'warning' : 'danger'
            }
            className="min-w-[8rem]"
          />
        ),
      },
      {
        id: 'days',
        header: 'Records',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{formatNumber(row.totalDays)}</span>,
      },
      {
        id: 'action',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/attendance?classId=${row.classId}`}>Open register</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="School attendance rate"
          value={formatPercent(schoolRate)}
          tone={schoolRate >= 92 ? 'success' : 'warning'}
          icon={<ClipboardCheck />}
          loading={summary.isPending}
        />
        <StatCard
          label="Classes with a register"
          value={rows.length}
          icon={<ClipboardCheck />}
          loading={summary.isPending}
        />
        <StatCard
          label="Classes below 85%"
          value={rows.filter((row) => row.attendanceRate < 85).length}
          tone="danger"
          icon={<Activity />}
          loading={summary.isPending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance by class</CardTitle>
          <CardDescription>Lowest first — these are the registers to look at.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.isPending ? (
            <LoadingState label="Loading attendance…" />
          ) : rows.length === 0 ? (
            <EmptyState compact icon={<ClipboardCheck />} title="No registers taken yet" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="className" {...chartTheme.axis} />
                  <YAxis domain={[0, 100]} {...chartTheme.axis} />
                  <ChartTooltip {...chartTheme.tooltip} />
                  <Bar dataKey="attendanceRate" name="Attendance %" radius={[4, 4, 0, 0]}>
                    {rows.map((row) => (
                      <Cell
                        key={row.classId}
                        fill={
                          row.attendanceRate >= 92
                            ? chartTheme.colors[2]
                            : row.attendanceRate >= 85
                              ? chartTheme.colors[3]
                              : chartTheme.colors[4]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable
        caption="Attendance rate for each class"
        data={rows}
        columns={columns}
        rowKey={(row) => row.classId}
        isLoading={summary.isPending}
        error={summary.error}
        onRetry={() => void summary.refetch()}
        emptyIcon={<ClipboardCheck />}
        emptyTitle="No registers taken yet"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                     */
/* -------------------------------------------------------------------------- */

function FinancePanel({ termId }: { termId: string }) {
  const overview = useFinanceOverview({ termId: termId || undefined });
  const data = overview.data;
  const currency = data?.currency ?? 'NGN';

  if (overview.isError) {
    return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Billed"
          value={formatCurrency(data?.totalBilled ?? 0, currency, { showDecimals: false })}
          icon={<Wallet />}
          loading={overview.isPending}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(data?.totalCollected ?? 0, currency, { showDecimals: false })}
          tone="success"
          icon={<Wallet />}
          loading={overview.isPending}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data?.totalOutstanding ?? 0, currency, { showDecimals: false })}
          tone="danger"
          to="/finance/debtors"
          icon={<Activity />}
          loading={overview.isPending}
        />
        <StatCard
          label="Collection rate"
          value={formatPercent(data?.collectionRate ?? 0)}
          hint={`${formatNumber(data?.debtorCount ?? 0)} families owing`}
          icon={<Wallet />}
          loading={overview.isPending}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Billed against collected</CardTitle>
            <CardDescription>The gap is the cash still to be recovered.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.isPending ? (
              <LoadingState label="Loading finance…" />
            ) : (data?.collectionTrend.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Wallet />} title="Nothing invoiced yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data?.collectionTrend}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="label" {...chartTheme.axis} />
                    <YAxis
                      {...chartTheme.axis}
                      tickFormatter={(value: number) => `${formatNumber(value / 1000)}k`}
                    />
                    <ChartTooltip
                      {...chartTheme.tooltip}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="billed"
                      name="Billed"
                      stroke={chartTheme.colors[1]}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="collected"
                      name="Collected"
                      stroke={chartTheme.colors[2]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By fee category</CardTitle>
            <CardDescription>Where the money is billed, and where it arrives.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {overview.isPending ? (
              <LoadingState label="Loading categories…" />
            ) : (data?.byCategory.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Wallet />} title="No fee categories billed yet" />
            ) : (
              <ul className="divide-y divide-border">
                {data?.byCategory.map((category) => (
                  <li key={category.category} className="space-y-1.5 px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{category.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(category.collected, currency, { showDecimals: false })} of{' '}
                        {formatCurrency(category.billed, currency, { showDecimals: false })}
                      </span>
                    </div>
                    <Progress
                      value={category.billed ? (category.collected / category.billed) * 100 : 0}
                      tone="success"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Admissions                                                                  */
/* -------------------------------------------------------------------------- */

function AdmissionsPanel() {
  const funnel = useAdmissionFunnel();
  const data = funnel.data;

  if (funnel.isError) {
    return <ErrorState error={funnel.error} onRetry={() => void funnel.refetch()} />;
  }

  const stages = data
    ? [
        { label: 'Received', value: data.received },
        { label: 'Screened', value: data.screened },
        { label: 'Shortlisted', value: data.shortlisted },
        { label: 'Offered', value: data.offered },
        { label: 'Accepted', value: data.accepted },
      ]
    : [];

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Applications"
          value={data?.received ?? 0}
          to="/admissions"
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Offers made"
          value={data?.offered ?? 0}
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Accepted"
          value={data?.accepted ?? 0}
          tone="success"
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Conversion rate"
          value={formatPercent(data?.conversionRate ?? 0)}
          hint="Offers that turned into enrolments"
          icon={<Activity />}
          loading={funnel.isPending}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admissions funnel</CardTitle>
            <CardDescription>{data?.sessionName ?? 'Current session'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.isPending ? (
              <LoadingState label="Loading admissions…" />
            ) : stages.length === 0 || stages[0].value === 0 ? (
              <EmptyState compact icon={<BadgeCheck />} title="No applications received yet" />
            ) : (
              stages.map((stage) => (
                <div key={stage.label} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(stage.value)}
                    </span>
                  </div>
                  <Progress
                    value={stages[0].value ? (stage.value / stages[0].value) * 100 : 0}
                    tone="primary"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applications by level</CardTitle>
            <CardDescription>Where demand is, and where offers convert.</CardDescription>
          </CardHeader>
          <CardContent>
            {funnel.isPending ? (
              <LoadingState label="Loading levels…" />
            ) : (data?.byLevel.length ?? 0) === 0 ? (
              <EmptyState compact icon={<BadgeCheck />} title="No applications by level yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.byLevel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="levelName" {...chartTheme.axis} />
                    <YAxis allowDecimals={false} {...chartTheme.axis} />
                    <ChartTooltip {...chartTheme.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="applications"
                      name="Applications"
                      fill={chartTheme.colors[0]}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="accepted"
                      name="Accepted"
                      fill={chartTheme.colors[2]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                       */
/* -------------------------------------------------------------------------- */

function StaffPanel({ termId }: { termId: string }) {
  const performance = useStaffPerformance(termId || undefined);

  const columns = useMemo<Column<StaffPerformanceRow>[]>(
    () => [
      {
        id: 'staff',
        header: 'Teacher',
        cell: (row) => (
          <div className="min-w-0">
            <Link
              to={`/staff/${row.staffId}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.staffName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{row.designation}</p>
          </div>
        ),
      },
      {
        id: 'classes',
        header: 'Classes',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{row.classCount}</span>,
      },
      {
        id: 'attendance',
        header: 'Registers',
        cell: (row) => <ComplianceCell value={row.attendanceCompliance} />,
      },
      {
        id: 'notes',
        header: 'Lesson notes',
        cell: (row) => <ComplianceCell value={row.lessonNoteCompliance} />,
      },
      {
        id: 'scores',
        header: 'Score entry',
        hideOnMobile: true,
        cell: (row) => <ComplianceCell value={row.scoreEntryTimeliness} />,
      },
      {
        id: 'coverage',
        header: 'Curriculum',
        hideOnMobile: true,
        cell: (row) => <ComplianceCell value={row.curriculumCoverage} />,
      },
      {
        id: 'composite',
        header: 'Overall',
        align: 'right',
        cell: (row) => <span className="font-medium tabular-nums">{row.compositeScore}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 pt-6">
      <DataTable
        caption="Compliance and curriculum coverage for each member of teaching staff"
        data={performance.data}
        columns={columns}
        rowKey={(row) => row.staffId}
        isLoading={performance.isPending}
        error={performance.error}
        onRetry={() => void performance.refetch()}
        emptyIcon={<UserCog />}
        emptyTitle="No teaching activity recorded yet"
        emptyDescription="Figures appear once staff start taking registers and submitting notes."
        toolbar={
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Teaching compliance</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Whether the routines that keep records honest are happening — registers taken, notes
                submitted, scores entered on time, syllabus covered. A prompt for support, not a
                league table to publish.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={(performance.data?.length ?? 0) === 0}
              onClick={() =>
                void exportRowsToXlsx(
                  `staff-performance-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  (performance.data ?? []).map((row) => ({
                    Teacher: row.staffName,
                    Designation: row.designation,
                    Classes: row.classCount,
                    'Register compliance': row.attendanceCompliance,
                    'Lesson note compliance': row.lessonNoteCompliance,
                    'Score entry timeliness': row.scoreEntryTimeliness,
                    'Curriculum coverage': row.curriculumCoverage,
                    Overall: row.compositeScore,
                  })),
                  { sheetName: 'Staff performance' },
                )
              }
            >
              <Download />
              Export
            </Button>
          </div>
        }
      />
    </div>
  );
}

function ComplianceCell({ value }: { value: number }) {
  return (
    <Progress
      value={value}
      showLabel
      tone={value >= 85 ? 'success' : value >= 65 ? 'warning' : 'danger'}
      className="min-w-[7rem]"
    />
  );
}
