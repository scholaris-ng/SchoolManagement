import { useParams } from 'react-router-dom';
import { BadgeCheck, Printer } from 'lucide-react';
import { formatDate, formatPercent, ordinal } from '@/lib/format';
import { env } from '@/lib/env';
import { useAuth } from '@/app/providers/auth-provider';
import { useIssueTranscript, useTranscript } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/data/qr-code';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { Field } from './transcript-page-parts';

/**
 * A student's full academic history.
 *
 * Built from historical enrolment and published results rather than the
 * student's current class, so a transcript for a child who moved from JSS 2
 * Gold to JSS 3 Silver reads correctly for each year (spec section 22).
 */
export function TranscriptPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { can } = useAuth();
  const transcript = useTranscript(studentId);
  const issue = useIssueTranscript(studentId ?? '');

  if (transcript.isPending) {
    return (
      <PageContainer>
        <PageHeader loading title="" breadcrumbs={[{ label: 'Transcripts', to: '/transcripts' }]} />
        <LoadingState label="Assembling the transcript…" />
      </PageContainer>
    );
  }

  if (transcript.isError || !transcript.data) {
    return (
      <PageContainer>
        <PageHeader title="Transcript" breadcrumbs={[{ label: 'Transcripts', to: '/transcripts' }]} />
        <ErrorState error={transcript.error} onRetry={() => void transcript.refetch()} />
      </PageContainer>
    );
  }

  const record = transcript.data;
  const verifyUrl = record.verificationCode
    ? `${env.appUrl}/verify/${record.verificationCode}`
    : null;

  return (
    <PageContainer>
      <div className="no-print">
        <PageHeader
          title={`Transcript · ${record.studentName}`}
          description={`${record.admissionNo} · admitted ${formatDate(record.admissionDate)}`}
          breadcrumbs={[
            { label: 'Transcripts', to: '/transcripts' },
            { label: record.studentName },
          ]}
          meta={
            <>
              <Badge tone="neutral">{record.status}</Badge>
              <Badge tone="primary">
                Cumulative average {formatPercent(record.cumulativeAverage)}
              </Badge>
              {record.issuedAt && (
                <span className="text-xs text-muted-foreground">
                  Issued {formatDate(record.issuedAt)} by {record.issuedByName}
                </span>
              )}
            </>
          }
          actions={
            <>
              {can('transcript.issue') && (
                <Button
                  variant="outline"
                  data-cy="transcript-issue"
                  loading={issue.isPending}
                  onClick={() => issue.mutate()}
                >
                  <BadgeCheck />
                  {record.issuedAt ? 'Re-issue' : 'Issue officially'}
                </Button>
              )}
              <Button data-cy="results-transcript-print" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            </>
          }
        />
      </div>

      {!record.issuedAt && (
        <Alert tone="warning" title="This transcript has not been officially issued" className="no-print">
          It can be read here, but it carries no verification code until an authorised member of
          staff issues it.
        </Alert>
      )}

      <div className="print-page rounded-lg border border-border bg-card p-6 print:border-0 print:p-0">
        <header className="border-b-2 border-foreground pb-3">
          <h2 className="text-lg font-bold uppercase tracking-wide">Academic transcript</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <Field label="Student" value={record.studentName} />
            <Field label="Admission number" value={record.admissionNo} />
            <Field label="Date of birth" value={formatDate(record.dateOfBirth)} />
            <Field label="Admitted" value={formatDate(record.admissionDate)} />
            <Field
              label="Left"
              value={record.exitDate ? formatDate(record.exitDate) : 'Still enrolled'}
            />
            <Field label="Status" value={record.status} />
          </dl>
        </header>

        {record.years.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No published results are recorded for this student yet.
          </p>
        ) : (
          record.years.map((year) => (
            <section key={`${year.sessionName}-${year.className}`} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-1">
                <h3 className="font-semibold">
                  {year.sessionName}
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {year.levelName} · {year.className}
                  </span>
                </h3>
                <p className="text-sm tabular-nums text-muted-foreground">
                  Year average {formatPercent(year.yearAverage)}
                </p>
              </div>

              <div className="grid gap-4 pt-2 md:grid-cols-3">
                {year.terms.map((term) => (
                  <div key={term.termName}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {term.termName}
                    </p>
                    <table className="mt-1 w-full text-sm">
                      <caption className="sr-only">
                        {term.termName} results for {year.sessionName}
                      </caption>
                      <tbody>
                        {term.subjects.map((subject) => (
                          <tr key={subject.subjectName} className="border-b border-border/60">
                            <td className="py-1 pr-2">{subject.subjectName}</td>
                            <td className="py-1 text-right tabular-nums">{subject.total}</td>
                            <td className="w-8 py-1 text-right font-medium">{subject.grade}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-medium">
                          <td className="py-1">Average</td>
                          <td className="py-1 text-right tabular-nums" colSpan={2}>
                            {formatPercent(term.average)}
                            {term.position ? ` · ${ordinal(term.position)}` : ''}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        <footer className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t-2 border-foreground pt-3 text-xs">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Cumulative average: {formatPercent(record.cumulativeAverage)}
            </p>
            {record.verificationCode && (
              <>
                <p className="text-muted-foreground">
                  Verification code <span className="font-mono">{record.verificationCode}</span>
                </p>
                {verifyUrl && <p className="break-all text-muted-foreground">{verifyUrl}</p>}
              </>
            )}
            <div className="pt-6">
              <p className="border-t border-foreground pt-1">Registrar&rsquo;s signature</p>
            </div>
          </div>
          {verifyUrl && <QrCode value={verifyUrl} size={96} />}
        </footer>
      </div>
    </PageContainer>
  );
}
