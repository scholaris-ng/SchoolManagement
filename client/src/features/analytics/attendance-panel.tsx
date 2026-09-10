import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ClipboardCheck,
} from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { useAttendanceSummary, type ClassAttendanceSummaryRow } from '@/features/attendance/api';
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
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function AttendancePanel() {
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
          <Button data-cy="analytics-open-register" variant="ghost" size="sm" asChild>
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

        data-cy="analytics-table-2"
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
