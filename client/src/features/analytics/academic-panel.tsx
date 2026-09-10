import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Download,
  GraduationCap,
  ScrollText,
} from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useResultAnalytics } from '@/features/results/api';
import type { SubjectPerformanceRow } from '@/types/analytics';
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
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme, gradeColor } from '@/components/charts/chart-theme';

export function AcademicPanel({ termId }: { termId: string }) {
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

        data-cy="analytics-table"
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
              data-cy="analytics-export"
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
