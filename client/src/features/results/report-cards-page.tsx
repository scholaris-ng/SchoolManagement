import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Printer } from 'lucide-react';
import { formatPercent, ordinal } from '@/lib/format';
import { useClasses, useCurrentTerm, useTerms } from '@/features/academics/api';
import { useStudents } from '@/features/students/api';
import { useBroadsheet } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import { EmptyState, LoadingState } from '@/components/ui/feedback';

/**
 * Report-card generation, by class.
 *
 * A form teacher does not want one report at a time; they want the whole class,
 * with positions already worked out, and a way to print the lot. The broadsheet
 * is the source of the ranking so the position on a report card and the one on
 * the broadsheet cannot disagree.
 */
export function ReportCardsPage() {
  const currentTerm = useCurrentTerm();
  const terms = useTerms();
  const classes = useClasses();

  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');

  const effectiveTermId = termId || currentTerm.data?.id || '';
  const broadsheet = useBroadsheet(classId || undefined, effectiveTermId || undefined);

  const students = useStudents({
    page: 1,
    pageSize: 200,
    classId: classId || undefined,
    status: 'ACTIVE',
  });

  const photoByStudent = useMemo(() => {
    const map = new Map<string, { url: string | null; consent: boolean }>();
    (students.data?.items ?? []).forEach((student) => {
      map.set(student.id, { url: student.photoUrl ?? null, consent: student.photoConsent });
    });
    return map;
  }, [students.data]);

  return (
    <PageContainer>
      <PageHeader
        title="Report cards"
        description="Generate and print termly reports for a whole class."
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Report cards' }]}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rc-term">Term</Label>
          <NativeSelect
            id="rc-term"
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
        <div className="space-y-1.5">
          <Label htmlFor="rc-class">Class</Label>
          <NativeSelect
            id="rc-class"
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
      </div>

      {!classId ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Choose a class"
            description="Pick a class and term to see every student's report, ranked."
          />
        </Card>
      ) : broadsheet.isPending ? (
        <LoadingState label="Working out positions…" />
      ) : (broadsheet.data?.rows.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="No published results for this class and term"
            description="Report cards are built from published score sheets. Publish the marks first."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {broadsheet.data?.className} · {broadsheet.data?.termName}
            </CardTitle>
            <CardDescription>
              {broadsheet.data?.rows.length} reports · class average{' '}
              {broadsheet.data?.classAverage.toFixed(1)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {broadsheet.data?.rows.map((row) => {
                const photo = photoByStudent.get(row.studentId);
                return (
                  <li key={row.studentId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar
                      name={row.studentName}
                      src={photo?.url}
                      suppressPhoto={photo ? !photo.consent : true}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.admissionNo}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm tabular-nums">
                      <span title="Average">{formatPercent(row.average)}</span>
                      <span className="text-muted-foreground">{row.grade}</span>
                      <span className="text-muted-foreground">{ordinal(row.position)}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/report-cards/${row.studentId}/${effectiveTermId}`}>
                        <Printer />
                        Open report
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
