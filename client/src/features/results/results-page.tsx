import { useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, ScrollText, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent, ordinal } from '@/lib/format';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useClasses, useCurrentTerm, useTerms } from '@/features/academics/api';
import { useBroadsheet, useResultAnalytics } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/data/stat-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme, gradeColor } from '@/components/charts/chart-theme';

type Tab = 'analytics' | 'broadsheet';

/**
 * Results seen from above: how the school performed, and the class broadsheet
 * that a head of department actually reads down.
 */
export function ResultsPage() {
  const [tab, setTab] = useState<Tab>('analytics');
  const currentTerm = useCurrentTerm();
  const terms = useTerms();
  const classes = useClasses();

  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');

  const effectiveTermId = termId || currentTerm.data?.id || '';
  const analytics = useResultAnalytics(effectiveTermId || undefined);
  const broadsheet = useBroadsheet(
    tab === 'broadsheet' ? classId || undefined : undefined,
    effectiveTermId || undefined,
  );

  const exportBroadsheet = () => {
    if (!broadsheet.data) return;
    void exportRowsToXlsx(
      `broadsheet-${broadsheet.data.className}-${broadsheet.data.termName}.xlsx`.replace(/\s+/g, '-'),
      broadsheet.data.rows.map((row) => ({
        Position: row.position,
        'Admission no': row.admissionNo,
        Student: row.studentName,
        ...Object.fromEntries(
          broadsheet.data!.subjects.map((subject) => [
            subject.subjectName,
            row.subjects[subject.subjectId] ?? '',
          ]),
        ),
        Total: row.total,
        Average: row.average,
        Grade: row.grade,
      })),
      { sheetName: `${broadsheet.data.className} broadsheet` },
    );
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Results"
        description="How the school is performing this term, subject by subject and class by class."
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Results' }]}
        actions={
          tab === 'broadsheet' &&
          broadsheet.data && (
            <Button data-cy="results-export-excel" variant="outline" onClick={exportBroadsheet}>
              <Download />
              Export Excel
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="results-term">Term</Label>
          <NativeSelect
            data-cy="results-term"
            id="results-term"
            value={effectiveTermId}
            onChange={(event) => setTermId(event.target.value)}
            className="w-auto"
          >
            {(terms.data ?? []).map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} · {term.sessionName}
              </option>
            ))}
          </NativeSelect>
        </div>

        {tab === 'broadsheet' && (
          <div className="space-y-1.5">
            <Label htmlFor="results-class">Class</Label>
            <NativeSelect
              data-cy="results-class"
              id="results-class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-auto"
            >
              <option value="">Choose a class…</option>
              {(classes.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Results view"
          className="ml-auto flex overflow-hidden rounded-md border border-border"
        >
          {(
            [
              { id: 'analytics' as const, label: 'Analytics' },
              { id: 'broadsheet' as const, label: 'Broadsheet' },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              data-cy={`results-tab-${option.id}`}
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                tab === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'analytics' ? (
        analytics.isPending ? (
          <LoadingState label="Loading results analytics…" />
        ) : analytics.isError ? (
          <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Overall average"
                value={formatPercent(analytics.data?.overallAverage ?? 0)}
                tone="primary"
              />
              <StatCard
                label="Pass rate"
                value={formatPercent(analytics.data?.passRate ?? 0)}
                tone={(analytics.data?.passRate ?? 0) >= 70 ? 'success' : 'warning'}
              />
              <StatCard
                label="Subjects assessed"
                value={analytics.data?.subjects.length ?? 0}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Average by subject</CardTitle>
                  <CardDescription>
                    A subject sitting well below the rest usually means a teaching gap, not a
                    cohort of weak students.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(analytics.data?.subjects.length ?? 0) === 0 ? (
                    <EmptyState compact icon={<ScrollText />} title="No results published yet" />
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.data?.subjects}
                          margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
                        >
                          <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                          <XAxis
                            dataKey="subjectName"
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={70}
                            {...chartTheme.axis}
                          />
                          <YAxis domain={[0, 100]} {...chartTheme.axis} />
                          <ChartTooltip {...chartTheme.tooltip} />
                          <Bar
                            dataKey="averageScore"
                            name="Average"
                            fill={chartTheme.colors[0]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grade spread</CardTitle>
                </CardHeader>
                <CardContent>
                  {(analytics.data?.gradeDistribution.length ?? 0) === 0 ? (
                    <EmptyState compact title="Nothing to show yet" />
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.data?.gradeDistribution}
                            dataKey="count"
                            nameKey="grade"
                            innerRadius="50%"
                            outerRadius="80%"
                            paddingAngle={2}
                          >
                            {analytics.data?.gradeDistribution.map((entry) => (
                              <Cell key={entry.grade} fill={entry.color ?? gradeColor(entry.grade)} />
                            ))}
                          </Pie>
                          <ChartTooltip {...chartTheme.tooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Subject detail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">
                      Average, pass rate, highest and lowest score for each subject
                    </caption>
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 text-left">Subject</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Average</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Pass rate</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Highest</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Lowest</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Assessed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analytics.data?.subjects.map((subject) => (
                        <tr key={subject.subjectId}>
                          <td className="px-3 py-2 font-medium">{subject.subjectName}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {subject.averageScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPercent(subject.passRate, 0)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{subject.highest}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{subject.lowest}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {subject.studentsAssessed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )
      ) : !classId ? (
        <Card>
          <EmptyState
            icon={<Table2 />}
            title="Choose a class"
            description="The broadsheet shows every student against every subject for one class and term."
          />
        </Card>
      ) : broadsheet.isPending ? (
        <LoadingState label="Building the broadsheet…" />
      ) : broadsheet.isError ? (
        <ErrorState error={broadsheet.error} onRetry={() => void broadsheet.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {broadsheet.data?.className} · {broadsheet.data?.termName}
            </CardTitle>
            <CardDescription>
              Class average {broadsheet.data?.classAverage.toFixed(1)} · {broadsheet.data?.rows.length}{' '}
              students
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Broadsheet: every student against every subject for this class and term
                </caption>
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left">
                      Student
                    </th>
                    {broadsheet.data?.subjects.map((subject) => (
                      <th key={subject.subjectId} scope="col" className="px-2 py-2.5 text-center">
                        {subject.subjectName.slice(0, 3).toUpperCase()}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Average</th>
                    <th scope="col" className="px-3 py-2.5 text-center">Grade</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {broadsheet.data?.rows.map((row) => (
                    <tr key={row.studentId} className="hover:bg-muted/40">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal"
                      >
                        <p className="truncate font-medium">{row.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.admissionNo}</p>
                      </th>
                      {broadsheet.data?.subjects.map((subject) => (
                        <td key={subject.subjectId} className="px-2 py-2 text-center tabular-nums">
                          {row.subjects[subject.subjectId] ?? '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{row.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.average.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">{row.grade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ordinal(row.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
