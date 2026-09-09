import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarX2 } from 'lucide-react';
import { formatDate, formatPercent, toDateInputValue } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useTerms } from '@/features/academics/api';
import { useStudentAttendance } from '../api';
import { StatCard } from '@/components/data/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/data/data-table';
import { StatusBadge } from '@/components/data/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';
import type { AttendanceRecord } from '@/types/attendance';

/**
 * A student's attendance with reasons, not a tick sheet — the reasons are what
 * make absence alerts and the retention signals meaningful (research feature 9).
 */
export function StudentAttendanceTab({ studentId }: { studentId: string }) {
  const terms = useTerms();
  const [termId, setTermId] = useState<string>('');

  const effectiveTermId = termId || terms.data?.find((term) => term.isCurrent)?.id || '';
  const attendance = useStudentAttendance(studentId, { termId: effectiveTermId || undefined });

  const byReason = useMemo(() => {
    const records = attendance.data?.records ?? [];
    const counts = new Map<string, number>();
    for (const record of records) {
      if (record.status === 'PRESENT') continue;
      const key = record.reason ?? 'UNEXPLAINED';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts, ([reason, count]) => ({
      reason: humanizeEnum(reason),
      count,
    })).sort((a, b) => b.count - a.count);
  }, [attendance.data?.records]);

  const columns = useMemo<Column<AttendanceRecord>[]>(
    () => [
      { id: 'date', header: 'Date', cell: (record) => formatDate(record.date) },
      { id: 'status', header: 'Status', cell: (record) => <StatusBadge status={record.status} /> },
      {
        id: 'reason',
        header: 'Reason',
        cell: (record) =>
          record.status === 'PRESENT' ? '—' : humanizeEnum(record.reason ?? 'UNEXPLAINED'),
      },
      {
        id: 'note',
        header: 'Note',
        hideOnMobile: true,
        cell: (record) => record.note ?? '—',
      },
      {
        id: 'markedBy',
        header: 'Marked by',
        hideOnMobile: true,
        cell: (record) => record.markedByName ?? '—',
      },
    ],
    [],
  );

  if (attendance.isPending) return <LoadingState label="Loading attendance…" />;
  if (attendance.isError) {
    return <ErrorState error={attendance.error} onRetry={() => void attendance.refetch()} />;
  }

  const summary = attendance.data?.summary;
  const absences = (attendance.data?.records ?? []).filter(
    (record) => record.status !== 'PRESENT',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary
            ? `${formatDate(summary.from)} – ${formatDate(summary.to)}`
            : toDateInputValue(new Date())}
        </p>
        <NativeSelect
          data-cy="tabs-attendance-effective-term-id"
          value={effectiveTermId}
          onChange={(event) => setTermId(event.target.value)}
          aria-label="Term"
          className="w-auto min-w-[12rem]"
        >
          {(terms.data ?? []).map((term) => (
            <option key={term.id} value={term.id}>
              {term.sessionName} · {term.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance rate"
          value={formatPercent(summary?.attendanceRate ?? 0)}
          tone={
            (summary?.attendanceRate ?? 0) >= 90
              ? 'success'
              : (summary?.attendanceRate ?? 0) >= 75
                ? 'warning'
                : 'danger'
          }
        />
        <StatCard label="Days present" value={summary?.present ?? 0} />
        <StatCard label="Days absent" value={summary?.absent ?? 0} />
        <StatCard
          label="Unexplained"
          value={summary?.unexplainedAbsences ?? 0}
          tone={(summary?.unexplainedAbsences ?? 0) > 0 ? 'warning' : 'neutral'}
          hint="Absences with no reason recorded"
        />
      </div>

      {byReason.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Why this student was away</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byReason} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                  <XAxis type="number" allowDecimals={false} {...chartTheme.axis} />
                  <YAxis type="category" dataKey="reason" width={110} {...chartTheme.axis} />
                  <ChartTooltip {...chartTheme.tooltip} />
                  <Bar dataKey="count" fill={chartTheme.colors[0]} radius={[0, 4, 4, 0]} name="Days" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {absences.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarX2 />}
            title="Full attendance this term"
            description="This student has not missed a day."
          />
        </Card>
      ) : (
        <DataTable
          data-cy="student-attendance-table"
          caption="Days this student was absent, late or excused, with the recorded reason"
          data={absences}
          columns={columns}
          rowKey={(record) => record.id}
          emptyTitle="No absences recorded"
        />
      )}
    </div>
  );
}
