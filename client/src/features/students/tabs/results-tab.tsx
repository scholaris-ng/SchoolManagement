import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ScrollText } from 'lucide-react';
import { formatPercent, ordinal } from '@/lib/format';
import { useTerms } from '@/features/academics/api';
import { useStudentResults } from '../api';
import { SubjectPerformanceChart } from '@/features/results/subject-performance-chart';
import { StatCard } from '@/components/data/stat-card';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/data/status-badge';
import { PermissionGate } from '@/components/guards/permission-gate';
import { gradeColor } from '@/components/charts/chart-theme';

export function StudentResultsTab({ studentId }: { studentId: string }) {
  const terms = useTerms();
  const [termId, setTermId] = useState('');
  const effectiveTermId = termId || terms.data?.find((term) => term.isCurrent)?.id || '';
  const results = useStudentResults(studentId, effectiveTermId || undefined);

  if (results.isPending) return <LoadingState label="Loading results…" />;
  if (results.isError) {
    return <ErrorState error={results.error} onRetry={() => void results.refetch()} />;
  }

  const report = results.data;

  if (!report || report.subjects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ScrollText />}
          title="No results for this term yet"
          description="Results appear here once subject teachers have entered scores and the school has approved them."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={report.status} />
          {report.status !== 'PUBLISHED' && (
            <span className="text-xs text-muted-foreground">
              Not yet visible to the parent
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
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
          <PermissionGate require="reportcard.read">
            <Button variant="outline" asChild>
              <Link to={`/report-cards/${studentId}/${effectiveTermId}`}>
                <FileText />
                Report card
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Average" value={formatPercent(report.average)} tone="primary" />
        <StatCard
          label="Total score"
          value={`${report.totalScore} / ${report.totalObtainable}`}
        />
        <StatCard
          label="Grade"
          value={<span style={{ color: gradeColor(report.grade) }}>{report.grade}</span>}
        />
        <StatCard
          label="Position"
          value={report.position ? ordinal(report.position) : '—'}
          hint={report.position ? `out of ${report.classSize} in ${report.className}` : 'Not ranked'}
        />
      </div>

      <SubjectPerformanceChart subjects={report.subjects} />

      <Card>
        <CardHeader>
          <CardTitle>Subject breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Scores per subject with class average and position
              </caption>
              <thead className="border-y border-border bg-muted/40">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subject
                  </th>
                  {report.subjects[0]?.components.map((component) => (
                    <th
                      key={component.componentId}
                      scope="col"
                      className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {component.name}
                      <span className="block font-normal normal-case">/{component.maxScore}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Grade
                  </th>
                  <th scope="col" className="hidden px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">
                    Class avg
                  </th>
                  <th scope="col" className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.subjects.map((subject) => (
                  <tr key={subject.subjectId}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {subject.subjectName}
                    </th>
                    {subject.components.map((component) => (
                      <td key={component.componentId} className="px-3 py-2 text-center tabular-nums">
                        {component.score ?? '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">
                      {subject.total ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {subject.grade ? (
                        <Badge
                          tone="outline"
                          style={{ color: gradeColor(subject.grade), borderColor: gradeColor(subject.grade) }}
                        >
                          {subject.grade}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-center tabular-nums text-muted-foreground sm:table-cell">
                      {subject.classAverage?.toFixed(1) ?? '—'}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                      {subject.remark ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(report.formTeacherComment || report.principalComment) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {report.formTeacherComment && (
            <Card>
              <CardHeader>
                <CardTitle>Form teacher's comment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{report.formTeacherComment}</p>
              </CardContent>
            </Card>
          )}
          {report.principalComment && (
            <Card>
              <CardHeader>
                <CardTitle>Principal's comment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{report.principalComment}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
