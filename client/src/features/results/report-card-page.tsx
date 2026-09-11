import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Save } from 'lucide-react';
import { formatDate, formatPercent, ordinal } from '@/lib/format';
import { env } from '@/lib/env';
import { contrastingTextColor } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useCommentTemplates, useReportCard, useSaveReportCardComments } from './api';
import { SubjectPerformanceChart } from './subject-performance-chart';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/data/status-badge';
import { QrCode } from '@/components/data/qr-code';
import { Field, CommentBlock } from './report-card-page-parts';

/**
 * One student's report card.
 *
 * Laid out to print onto a single sheet with the school's own branding, and to
 * read on a phone — many parents will only ever see it on a screen. Photo
 * consent is respected here as everywhere: a child whose guardian has not
 * consented gets initials, not a photograph (spec section 41).
 */
export function ReportCardPage() {
  const { studentId, termId } = useParams<{ studentId: string; termId: string }>();
  const { can } = useAuth();
  const card = useReportCard(studentId, termId);
  const templates = useCommentTemplates();
  const saveComments = useSaveReportCardComments(studentId ?? '', termId ?? '');

  const [formTeacherComment, setFormTeacherComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!card.data) return;
    setFormTeacherComment(card.data.formTeacherComment ?? '');
    setPrincipalComment(card.data.principalComment ?? '');
    setDirty(false);
  }, [card.data]);

  if (card.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Building the report card…" />
      </PageContainer>
    );
  }

  if (card.isError || !card.data) {
    return (
      <PageContainer>
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      </PageContainer>
    );
  }

  const report = card.data;
  const canComment = can('reportcard.generate');
  const verifyUrl = report.verificationCode
    ? `${env.appUrl}/verify/${report.verificationCode}`
    : null;

  return (
    <PageContainer>
      <div className="no-print">
        <PageHeader
          title={`${report.studentName} · ${report.termName}`}
          description={`${report.className} · ${report.sessionName}`}
          breadcrumbs={[
            { label: 'Report cards', to: '/report-cards' },
            { label: report.studentName },
          ]}
          meta={
            <>
              <StatusBadge status={report.status} />
              {report.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  Published {formatDate(report.publishedAt)}
                </span>
              )}
            </>
          }
          actions={
            <>
              {canComment && (
                <Button
                  data-cy="results-report-card-save-comments"
                  variant="outline"
                  disabled={!dirty}
                  loading={saveComments.isPending}
                  onClick={() =>
                    void saveComments
                      .mutateAsync({ formTeacherComment, principalComment })
                      .then(() => setDirty(false))
                  }
                >
                  <Save />
                  Save comments
                </Button>
              )}
              <Button data-cy="results-report-card-print" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            </>
          }
        />
      </div>

      {report.status !== 'PUBLISHED' && (
        <Alert tone="warning" title="This report is not published" className="no-print">
          Parents cannot see it yet. Publish the underlying score sheets first.
        </Alert>
      )}

      {/* The printable document ------------------------------------------- */}
      <div className="print-page rounded-lg border border-border bg-card p-6 print:border-0 print:p-0">
        <header
          className="flex flex-wrap items-center gap-4 border-b-2 pb-4"
          style={{ borderColor: report.school.primaryColor }}
        >
          {report.school.logoUrl ? (
            <img src={report.school.logoUrl} alt="" className="size-16 object-contain" />
          ) : (
            <span
              className="grid size-16 shrink-0 place-items-center rounded-lg text-xl font-bold"
              style={{
                backgroundColor: report.school.primaryColor,
                // The school's own picked colour, printed onto a document a
                // parent reads — pale brand colours make hardcoded white text
                // as illegible here as it was on the avatar initials.
                color: contrastingTextColor(report.school.primaryColor),
              }}
              aria-hidden="true"
            >
              {report.school.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{report.school.name}</h2>
            <p className="text-sm text-muted-foreground">{report.school.address}</p>
            {report.school.motto && (
              <p className="text-xs italic text-muted-foreground">{report.school.motto}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold uppercase tracking-wide">Termly report</p>
            <p className="text-muted-foreground">
              {report.termName} · {report.sessionName}
            </p>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-4 py-4">
          <Avatar
            name={report.studentName}
            src={report.photoUrl}
            suppressPhoto={!report.photoConsent}
            size="xl"
          />
          <dl className="grid flex-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <Field label="Student" value={report.studentName} />
            <Field label="Admission number" value={report.admissionNo} />
            <Field label="Class" value={`${report.className} · ${report.levelName}`} />
            <Field label="Average" value={formatPercent(report.average)} />
            <Field
              label="Position"
              value={
                report.position ? `${ordinal(report.position)} of ${report.classSize}` : 'Not ranked'
              }
            />
            <Field label="Overall grade" value={report.grade} />
          </dl>
        </section>

        <section className="py-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Subjects</h3>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Subject results with component marks, grade and class comparison
              </caption>
              <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left">Subject</th>
                  {report.subjects[0]?.components.map((component) => (
                    <th key={component.componentId} scope="col" className="px-2 py-2 text-center">
                      {component.name}
                      <span className="block font-normal normal-case">/{component.maxScore}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right">Total</th>
                  <th scope="col" className="px-2 py-2 text-center">Grade</th>
                  <th scope="col" className="px-2 py-2 text-center">Class avg</th>
                  <th scope="col" className="px-2 py-2 text-left">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.subjects.map((subject) => (
                  <tr key={subject.subjectId}>
                    <td className="px-2 py-1.5 font-medium">{subject.subjectName}</td>
                    {subject.components.map((component) => (
                      <td key={component.componentId} className="px-2 py-1.5 text-center tabular-nums">
                        {component.score ?? '—'}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {subject.total ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">{subject.grade ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                      {subject.classAverage?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{subject.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border font-medium">
                <tr>
                  <td className="px-2 py-2">Total</td>
                  {report.subjects[0]?.components.map((component) => (
                    <td key={component.componentId} />
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {report.totalScore} / {report.totalObtainable}
                  </td>
                  <td className="px-2 py-2 text-center">{report.grade}</td>
                  <td colSpan={2} className="px-2 py-2 text-right tabular-nums">
                    Average {formatPercent(report.average)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="grid gap-4 py-3 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Attendance</h3>
            <dl className="grid grid-cols-2 gap-1.5 text-sm">
              <Field label="Days open" value={report.attendance.total} />
              <Field label="Present" value={report.attendance.present} />
              <Field label="Absent" value={report.attendance.absent} />
              <Field label="Late" value={report.attendance.late} />
              <Field label="Attendance rate" value={formatPercent(report.attendance.rate)} />
            </dl>
          </section>

          {report.behaviour.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">
                Behaviour and skills
              </h3>
              <ul className="space-y-1 text-sm">
                {report.behaviour.map((trait) => (
                  <li key={trait.traitId} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-muted-foreground">{trait.traitName}</span>
                    <span className="shrink-0 font-medium">
                      {trait.label}{' '}
                      <span className="text-muted-foreground">
                        ({trait.rating}/{trait.scaleMax})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="space-y-3 border-t border-border pt-3">
          <CommentBlock
            label="Form teacher's comment"
            value={formTeacherComment}
            editable={canComment}
            templates={(templates.data ?? [])
              .filter((template) => template.audience === 'FORM_TEACHER')
              .map((template) => template.text)}
            onChange={(value) => {
              setFormTeacherComment(value);
              setDirty(true);
            }}
          />
          <CommentBlock
            label="Principal's comment"
            value={principalComment}
            editable={canComment}
            templates={(templates.data ?? [])
              .filter((template) => template.audience === 'PRINCIPAL')
              .map((template) => template.text)}
            onChange={(value) => {
              setPrincipalComment(value);
              setDirty(true);
            }}
          />
        </section>

        <footer className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <div>
            {report.nextTermBegins && (
              <p>
                Next term begins <strong>{formatDate(report.nextTermBegins)}</strong>
              </p>
            )}
            {report.verificationCode && (
              <p className="mt-1">
                Verification code <span className="font-mono">{report.verificationCode}</span>
              </p>
            )}
            {verifyUrl && <p className="break-all">Check this document at {verifyUrl}</p>}
          </div>
          {verifyUrl && <QrCode value={verifyUrl} />}
        </footer>
      </div>

      <div className="no-print">
        <SubjectPerformanceChart subjects={report.subjects} />
      </div>
    </PageContainer>
  );
}
