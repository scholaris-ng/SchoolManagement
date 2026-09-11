import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  UserPlus,
  X,
} from 'lucide-react';
import { formatDate, formatDateTime, formatFileSize } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useClassOptions } from '@/features/academics/api';
import { useAdmission, useTransitionAdmission } from './api';
import { ConvertApplicantDialog } from './convert-applicant-dialog';
import type { ApplicationStatus } from '@/types/admissions';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { Field } from './admission-detail-page-parts';

/** Which statuses may follow the current one, in the order staff work through. */
const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['SCREENING', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['OFFERED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Move back to draft',
  SUBMITTED: 'Mark as submitted',
  SCREENING: 'Begin screening',
  SHORTLISTED: 'Shortlist',
  OFFERED: 'Offer a place',
  ACCEPTED: 'Record acceptance',
  REJECTED: 'Reject',
  WITHDRAWN: 'Mark withdrawn',
};

export function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const application = useAdmission(id);
  const transition = useTransitionAdmission(id ?? '');
  const classOptions = useClassOptions();

  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [screeningScore, setScreeningScore] = useState('');
  const [offeredClassId, setOfferedClassId] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);

  if (application.isPending) {
    return (
      <PageContainer>
        <PageHeader loading title="" breadcrumbs={[{ label: 'Admissions', to: '/admissions' }]} />
        <LoadingState label="Loading application…" />
      </PageContainer>
    );
  }

  if (application.isError || !application.data) {
    return (
      <PageContainer>
        <PageHeader title="Application" breadcrumbs={[{ label: 'Admissions', to: '/admissions' }]} />
        <ErrorState error={application.error} onRetry={() => void application.refetch()} />
      </PageContainer>
    );
  }

  const record = application.data;
  const applicant = record.applicant;
  const applicantName = [applicant.firstName, applicant.middleName, applicant.lastName]
    .filter(Boolean)
    .join(' ');

  const openTransition = (status: ApplicationStatus) => {
    setPendingStatus(status);
    setNote('');
    setScreeningScore(record.screeningScore != null ? String(record.screeningScore) : '');
    setOfferedClassId(record.offeredClassId ?? '');
  };

  const submitTransition = async () => {
    if (!pendingStatus) return;
    await transition.mutateAsync({
      status: pendingStatus,
      note: note.trim() || undefined,
      screeningScore:
        pendingStatus === 'SHORTLISTED' || pendingStatus === 'SCREENING'
          ? screeningScore
            ? Number(screeningScore)
            : undefined
          : undefined,
      offeredClassId: pendingStatus === 'OFFERED' ? offeredClassId || undefined : undefined,
    });
    setPendingStatus(null);
  };

  const canManage = can('admission.manage');
  const nextStatuses = NEXT_STATUSES[record.status];

  return (
    <PageContainer>
      <PageHeader
        title={applicantName}
        description={`Applying for ${record.levelName} · ${record.sessionName}`}
        breadcrumbs={[
          { label: 'Admissions', to: '/admissions' },
          { label: record.applicationNo },
        ]}
        meta={
          <>
            <StatusBadge status={record.status} />
            <Badge tone="neutral">{record.applicationNo}</Badge>
            {record.submittedAt && (
              <span className="text-xs text-muted-foreground">
                Submitted {formatDate(record.submittedAt)}
              </span>
            )}
          </>
        }
        actions={
          <>
            {canManage &&
              nextStatuses.map((status) => (
                <Button
                  key={status}
                  data-cy={`admission-transition-${status.toLowerCase()}`}
                  variant={status === 'REJECTED' || status === 'WITHDRAWN' ? 'outline' : 'primary'}
                  onClick={() => openTransition(status)}
                >
                  {status === 'REJECTED' ? <X /> : <Check />}
                  {STATUS_LABEL[status]}
                </Button>
              ))}
            {record.status === 'ACCEPTED' && !record.convertedStudentId && can('student.create') && (
              <Button data-cy="admissions-admission-detail-enrol-as-a-student" onClick={() => setConvertOpen(true)}>
                <UserPlus />
                Enrol as a student
              </Button>
            )}
            {record.convertedStudentId && (
              <Button data-cy="admissions-admission-detail-open-student-record" variant="outline" asChild>
                <Link to={`/students/${record.convertedStudentId}`}>
                  <GraduationCap />
                  Open student record
                </Link>
              </Button>
            )}
          </>
        }
      />

      {record.convertedStudentId && (
        <Alert tone="success" title="This applicant has been enrolled">
          A student record was created from this application, so it cannot be converted again.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Applicant</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Full name" value={applicantName} />
                <Field label="Gender" value={humanizeEnum(applicant.gender)} />
                <Field label="Date of birth" value={formatDate(applicant.dateOfBirth)} />
                <Field label="Nationality" value={applicant.nationality ?? '—'} />
                <Field label="State of origin" value={applicant.stateOfOrigin ?? '—'} />
                <Field label="Previous school" value={applicant.previousSchool ?? '—'} />
                <Field label="Blood group" value={applicant.bloodGroup ?? '—'} />
                <Field label="Home address" value={applicant.address ?? '—'} />
                {applicant.medicalNotes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Medical notes
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-line">{applicant.medicalNotes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parents and guardians</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {record.guardians.map((guardian, index) => (
                  <li key={index} className="space-y-1 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {guardian.title ? `${guardian.title} ` : ''}
                        {guardian.firstName} {guardian.lastName}
                      </p>
                      <Badge tone="neutral">{humanizeEnum(guardian.relationship)}</Badge>
                      {guardian.isPrimaryContact && <Badge tone="primary">Primary contact</Badge>}
                    </div>
                    <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3" aria-hidden="true" />
                        {guardian.phone}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3" aria-hidden="true" />
                        {guardian.email}
                      </span>
                    </p>
                    {guardian.occupation && (
                      <p className="text-xs text-muted-foreground">{guardian.occupation}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Supporting files submitted with the application. They follow the child into their
                student record on enrolment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {record.documents.length === 0 ? (
                <EmptyState compact icon={<FileText />} title="No documents attached" />
              ) : (
                <ul className="divide-y divide-border">
                  {record.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <FileText
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{document.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {humanizeEnum(document.category)} · {formatFileSize(document.sizeBytes)} ·{' '}
                          {formatDate(document.uploadedAt)}
                        </p>
                      </div>
                      {document.downloadUrl && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          data-cy={`admission-document-download-${document.id}`}
                        >
                          <a
                            href={document.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Download ${document.name}`}
                          >
                            <Download />
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field
                label="Screening score"
                value={record.screeningScore != null ? String(record.screeningScore) : 'Not scored'}
              />
              <Field
                label="Interview"
                value={record.interviewDate ? formatDateTime(record.interviewDate) : 'Not scheduled'}
              />
              <Field label="Offered class" value={record.offeredClassName ?? '—'} />
              <Field
                label="Offer expires"
                value={record.offerExpiresOn ? formatDate(record.offerExpiresOn) : '—'}
              />
              {record.decisionNote && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Decision note
                  </p>
                  <p className="mt-0.5 whitespace-pre-line">{record.decisionNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {[...record.timeline].reverse().map((event) => (
                  <li key={event.id} className="flex gap-3 px-5 py-3 text-sm">
                    <CalendarDays
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <StatusBadge status={event.status} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.actorName} · {formatDateTime(event.occurredAt)}
                      </p>
                      {event.note && <p className="mt-1">{event.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{pendingStatus ? STATUS_LABEL[pendingStatus] : ''}</DialogTitle>
            <DialogDescription>
              This is recorded against the application with your name and the time, and the family
              is notified where the school has enabled it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {(pendingStatus === 'SCREENING' || pendingStatus === 'SHORTLISTED') && (
              <div className="space-y-1.5">
                <Label htmlFor="screening-score">Screening score</Label>
                <Input
                  data-cy="screening-score"
                  id="screening-score"
                  type="number"
                  min={0}
                  max={100}
                  value={screeningScore}
                  onChange={(event) => setScreeningScore(event.target.value)}
                  placeholder="Out of 100"
                />
              </div>
            )}

            {pendingStatus === 'OFFERED' && (
              <div className="space-y-1.5">
                <Label htmlFor="offered-class" required>
                  Class being offered
                </Label>
                <NativeSelect
                  data-cy="offered-class"
                  id="offered-class"
                  value={offeredClassId}
                  onChange={(event) => setOfferedClassId(event.target.value)}
                >
                  <option value="">Select a class</option>
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="transition-note">Note</Label>
              <Textarea
                data-cy="transition-note"
                id="transition-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional — what the family should be told, or why."
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button data-cy="admissions-admission-detail-cancel" type="button" variant="outline" onClick={() => setPendingStatus(null)}>
              Cancel
            </Button>
            <Button
              data-cy="admissions-admission-detail-confirm"
              onClick={() => void submitTransition()}
              loading={transition.isPending}
              disabled={pendingStatus === 'OFFERED' && !offeredClassId}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConvertApplicantDialog
        application={record}
        open={convertOpen}
        onOpenChange={setConvertOpen}
      />
    </PageContainer>
  );
}
