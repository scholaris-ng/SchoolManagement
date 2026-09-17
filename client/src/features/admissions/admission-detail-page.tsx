import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  Check,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Unlink,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  toDateInputValue,
  toDateTimeInputValue,
} from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useClassOptions } from '@/features/academics/api';
import { useGuardianOptions } from '@/features/guardians/api';
import {
  useAdmission,
  useLinkApplicationGuardian,
  useScheduleInterview,
  useTransitionAdmission,
  useUnlinkApplicationGuardian,
  useUpdateScreeningScore,
} from './api';
import { ConvertApplicantDialog } from './convert-applicant-dialog';
import {
  admissionGuardianLinkSchema,
  RELATIONSHIP_OPTIONS,
  type AdmissionGuardianLinkValues,
} from './schema';
import type { ApplicationStatus, InterviewOutcome } from '@/types/admissions';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, EmptyState, ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
} from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { CheckboxField, SelectField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';
import { Field } from './admission-detail-page-parts';

/**
 * Which statuses may follow the current one, in the order staff work through
 * — mirrors `ALLOWED_NEXT` on the server (spec section 10 as amended).
 *
 * Screening and shortlisting are steps a school may choose to skip rather
 * than a fixed sequence, so every pre-decision stage offers every decision
 * (`OFFERED`, `ACCEPTED`, `REJECTED`) as a button, not only the next one.
 */
const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['SCREENING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLISTED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
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

/**
 * `STATUS_LABEL` reads correctly once an offer is already on record — but
 * jumping straight to `ACCEPTED` from anywhere earlier is a school waiving
 * screening and admitting on the spot, not "recording" an acceptance that
 * never happened, so that jump gets its own wording.
 */
function labelFor(from: ApplicationStatus, to: ApplicationStatus): string {
  if (to === 'ACCEPTED' && from !== 'OFFERED') return 'Admit without screening';
  return STATUS_LABEL[to];
}

/** What each button actually does, for a reader who has never seen this workflow before. */
function descriptionFor(from: ApplicationStatus, to: ApplicationStatus): string {
  switch (to) {
    case 'SCREENING':
      return 'Starts the school’s own review — interviews, tests, or whatever it normally does before deciding.';
    case 'SHORTLISTED':
      return 'Marks the applicant as a strong candidate, without yet offering them a place.';
    case 'OFFERED':
      return 'Reserves a specific class for the applicant and tells the family. They still need to accept before enrolment.';
    case 'ACCEPTED':
      return from === 'OFFERED'
        ? 'Records that the family has accepted the offered place. The applicant can then be enrolled as a student.'
        : 'Skips screening, shortlisting and a separate offer, and admits the applicant straight away. They can then be enrolled as a student.';
    case 'REJECTED':
      return 'Declines the application. This ends it — no further stage is possible.';
    case 'WITHDRAWN':
      return 'Records that the family pulled out of the process themselves, rather than the school declining them.';
    default:
      return STATUS_LABEL[to];
  }
}

export function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const application = useAdmission(id);
  const transition = useTransitionAdmission(id ?? '');
  const scheduleInterview = useScheduleInterview(id ?? '');
  const updateScreeningScore = useUpdateScreeningScore(id ?? '');
  const unlinkGuardian = useUnlinkApplicationGuardian(id ?? '');
  const classOptions = useClassOptions();

  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [screeningScore, setScreeningScore] = useState('');
  const [offeredClassId, setOfferedClassId] = useState('');
  const [offerExpiresOn, setOfferExpiresOn] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [linkGuardianOpen, setLinkGuardianOpen] = useState(false);
  const [pendingUnlinkGuardian, setPendingUnlinkGuardian] = useState<string | null>(null);
  const [scoreEditOpen, setScoreEditOpen] = useState(false);
  const [scoreEditValue, setScoreEditValue] = useState('');

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewVenue, setInterviewVenue] = useState('');
  const [interviewOutcome, setInterviewOutcome] = useState<InterviewOutcome | ''>('');
  const [interviewNote, setInterviewNote] = useState('');

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

  // A class is needed wherever a place is being decided and none is on record
  // yet — ordinarily only when offering one, but also when a school waives
  // screening and admits straight from submission, since that skips the step
  // that would otherwise have captured it.
  const needsClassChoice = (status: ApplicationStatus | null) =>
    status === 'OFFERED' || (status === 'ACCEPTED' && !record.offeredClassId);

  const openTransition = (status: ApplicationStatus) => {
    setPendingStatus(status);
    setNote('');
    setScreeningScore(record.screeningScore != null ? String(record.screeningScore) : '');
    // Default to whatever was already offered, or failing that the class the
    // applicant themselves asked for — staff can still pick a different one.
    setOfferedClassId(record.offeredClassId ?? record.desiredClassId ?? '');
    setOfferExpiresOn(record.offerExpiresOn ?? '');
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
      offeredClassId: needsClassChoice(pendingStatus) ? offeredClassId || undefined : undefined,
      // A deadline only means something for a fresh offer — once accepted
      // there is nothing left to wait on.
      offerExpiresOn: pendingStatus === 'OFFERED' ? offerExpiresOn || undefined : undefined,
    });
    setPendingStatus(null);
  };

  const openInterview = () => {
    setInterviewDate(toDateTimeInputValue(record.interviewDate));
    setInterviewVenue(record.interviewVenue ?? '');
    setInterviewOutcome(record.interviewOutcome ?? '');
    setInterviewNote('');
    setInterviewOpen(true);
  };

  const submitInterview = async () => {
    await scheduleInterview.mutateAsync({
      interviewDate: interviewDate ? new Date(interviewDate).toISOString() : null,
      interviewVenue: interviewVenue.trim() || null,
      interviewOutcome: interviewOutcome || null,
      interviewNote: interviewNote.trim() || undefined,
    });
    setInterviewOpen(false);
  };

  const openScore = () => {
    setScoreEditValue(record.screeningScore != null ? String(record.screeningScore) : '');
    setScoreEditOpen(true);
  };

  const submitScore = async () => {
    await updateScreeningScore.mutateAsync({
      screeningScore: scoreEditValue ? Number(scoreEditValue) : null,
    });
    setScoreEditOpen(false);
  };

  const canManage = can('admission.manage');
  const nextStatuses = NEXT_STATUSES[record.status];
  // True once the application has reached a decision without ever passing
  // through `SCREENING` — the only way to tell, after the fact, that a place
  // was offered or accepted with the test waived rather than sat and passed.
  const screeningWasSkipped =
    (record.status === 'OFFERED' || record.status === 'ACCEPTED') &&
    !record.timeline.some((event) => event.status === 'SCREENING');

  return (
    <PageContainer>
      <PageHeader
        title={applicantName}
        description={`Applying for ${record.desiredClassName ?? record.levelName} · ${record.sessionName}`}
        breadcrumbs={[
          { label: 'Admissions', to: '/admissions' },
          { label: record.applicationNo },
        ]}
        meta={
          <>
            <StatusBadge status={record.status} />
            <Badge tone="neutral">{record.applicationNo}</Badge>
            {/* Where it came from, and who filled it in. Both change how the
                office handles it: a website application has been checked by
                nobody, and a self-filed one is answered to the applicant. */}
            {record.source === 'WEBSITE' && <Badge tone="neutral">From the website</Badge>}
            {record.applicantType === 'SELF' && (
              <Badge tone="neutral">Applied for themselves</Badge>
            )}
            {screeningWasSkipped && (
              <Tooltip
                content={
                  record.status === 'OFFERED'
                    ? 'This applicant was offered a place without ever being screened.'
                    : 'This applicant was accepted without ever being screened.'
                }
              >
                {/* `Badge` renders a plain function component, not one that
                    forwards refs — wrapped in a `span` so Radix has a real DOM
                    node to anchor the tooltip to. */}
                <span className="inline-flex">
                  <Badge tone="warning">Screening skipped</Badge>
                </span>
              </Tooltip>
            )}
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
                <Tooltip key={status} content={descriptionFor(record.status, status)}>
                  <Button
                    data-cy={`admission-transition-${status.toLowerCase()}`}
                    variant={status === 'REJECTED' || status === 'WITHDRAWN' ? 'outline' : 'primary'}
                    onClick={() => openTransition(status)}
                  >
                    {status === 'REJECTED' ? <X /> : <Check />}
                    {labelFor(record.status, status)}
                  </Button>
                </Tooltip>
              ))}
            {canManage && !record.convertedStudentId && (
              <Button
                data-cy="admissions-admission-detail-schedule-interview"
                variant="outline"
                onClick={openInterview}
              >
                <CalendarClock />
                {record.interviewDate ? 'Edit interview' : 'Schedule interview'}
              </Button>
            )}
            {/* Enrolling creates the pupil and, with them, the guardian records
                for everyone on the application — so it takes both permissions,
                and the server enforces the same pair. */}
            {record.status === 'ACCEPTED' &&
              !record.convertedStudentId &&
              can({ allOf: ['student.create', 'guardian.manage'] }) && (
                <Tooltip content="Enrolling creates the pupil's record and the guardian's portal account — confirm the guardian has paid their deposit before doing this.">
                  <Button
                    data-cy="admissions-admission-detail-enrol-as-a-student"
                    onClick={() => setConvertOpen(true)}
                  >
                    <UserPlus />
                    Enrol as a student
                  </Button>
                </Tooltip>
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
                <Field label="Previous class" value={applicant.previousClass ?? '—'} />
                <Field label="Blood group" value={applicant.bloodGroup ?? '—'} />
                <Field label="Home address" value={applicant.address ?? '—'} />
                <Field label="City" value={applicant.city ?? '—'} />
                <Field label="State" value={applicant.state ?? '—'} />
                {/* Only ever filled where the applicant applied for themselves,
                    so it is shown only then rather than as two empty rows. */}
                {record.applicantType === 'SELF' && (
                  <>
                    <Field label="Their email" value={applicant.email ?? '—'} />
                    <Field label="Their phone" value={applicant.phone ?? '—'} />
                  </>
                )}
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
              <CardTitle>
                {record.applicantType === 'SELF'
                  ? 'Parent, guardian or next of kin'
                  : 'Parents and guardians'}
              </CardTitle>
              <CardDescription>
                {record.convertedStudentId
                  ? 'These people now have guardian records, created when the applicant was enrolled.'
                  : 'Held with this application only. Nobody here has a guardian record, portal access or a fee account until the applicant is enrolled.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {record.contacts.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Phone />}
                  title="No contact recorded yet"
                  description="Add one from the office, or link an existing guardian record below."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {record.contacts.map((contact, index) => (
                    <li key={index} className="space-y-1 px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {contact.title ? `${contact.title} ` : ''}
                          {contact.firstName} {contact.lastName}
                        </p>
                        <Badge tone="neutral">{humanizeEnum(contact.relationship)}</Badge>
                        {contact.isPrimaryContact && <Badge tone="primary">Primary contact</Badge>}
                      </div>
                      <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3" aria-hidden="true" />
                          {contact.phone}
                        </span>
                        {contact.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="size-3" aria-hidden="true" />
                            {contact.email}
                          </span>
                        )}
                      </p>
                      {contact.occupation && (
                        <p className="text-xs text-muted-foreground">{contact.occupation}</p>
                      )}
                      {(contact.address || contact.city || contact.state) && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                          {[contact.address, contact.city, contact.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Guardian records</CardTitle>
                  <CardDescription>
                    Existing guardian records attached to this application — a family the office
                    already knows, such as a sibling already on roll. Linking one grants nothing by
                    itself; portal access, billing and pickup rights still wait for enrollment.
                  </CardDescription>
                </div>
                {canManage && !record.convertedStudentId && (
                  <Button
                    data-cy="admissions-admission-detail-link-guardian"
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkGuardianOpen(true)}
                  >
                    <UserPlus />
                    Link a guardian
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {record.linkedGuardians.length === 0 ? (
                <EmptyState compact icon={<Users />} title="No guardian records linked" />
              ) : (
                <ul className="divide-y divide-border">
                  {record.linkedGuardians.map((link) => (
                    <li key={link.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Avatar name={link.guardianName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/guardians/${link.guardianId}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {link.guardianName}
                          </Link>
                          <Badge tone="neutral">{humanizeEnum(link.relationship)}</Badge>
                          {link.isPrimaryContact && <Badge tone="primary">Primary contact</Badge>}
                        </div>
                        <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Phone className="size-3" aria-hidden="true" />
                            {link.guardianPhone}
                          </span>
                          {link.guardianEmail && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="size-3" aria-hidden="true" />
                              {link.guardianEmail}
                            </span>
                          )}
                        </p>
                      </div>
                      {canManage && !record.convertedStudentId && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          data-cy={`admission-guardian-unlink-${link.id}`}
                          onClick={() => setPendingUnlinkGuardian(link.id)}
                          aria-label={`Unlink ${link.guardianName}`}
                        >
                          <Unlink />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Decision</CardTitle>
                {canManage && !record.convertedStudentId && (
                  <Button
                    data-cy="admissions-admission-detail-edit-score"
                    variant="ghost"
                    size="sm"
                    onClick={openScore}
                  >
                    <Pencil />
                    Edit score
                  </Button>
                )}
              </div>
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
              {record.interviewVenue && <Field label="Interview venue" value={record.interviewVenue} />}
              {record.interviewOutcome && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Interview outcome
                  </p>
                  <Badge tone={record.interviewOutcome === 'PASSED' ? 'success' : 'danger'}>
                    {humanizeEnum(record.interviewOutcome)}
                  </Badge>
                </div>
              )}
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
            <DialogTitle>{pendingStatus ? labelFor(record.status, pendingStatus) : ''}</DialogTitle>
            <DialogDescription>
              This is recorded against the application with your name and the time, and the
              family's primary contact is emailed about it automatically.
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

            {needsClassChoice(pendingStatus) && (
              <div className="space-y-1.5">
                <Label htmlFor="offered-class" required>
                  {pendingStatus === 'OFFERED'
                    ? 'Class being offered'
                    : 'Class they are being admitted into'}
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

            {pendingStatus === 'OFFERED' && (
              <div className="space-y-1.5">
                <Label htmlFor="offer-expires">Respond by</Label>
                <Input
                  data-cy="offer-expires"
                  id="offer-expires"
                  type="date"
                  min={toDateInputValue(new Date())}
                  value={offerExpiresOn}
                  onChange={(event) => setOfferExpiresOn(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Included in the email to the family as the deadline to confirm. Leave blank for
                  no deadline.
                </p>
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
              disabled={needsClassChoice(pendingStatus) && !offeredClassId}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{record.interviewDate ? 'Edit interview' : 'Schedule interview'}</DialogTitle>
            <DialogDescription>
              Setting a date and time emails the family the details automatically. Recording an
              outcome does not — it's just a note here, and never changes the application's
              status. Use the status buttons above for the actual decision.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="interview-date">Date and time</Label>
              <Input
                data-cy="interview-date"
                id="interview-date"
                type="datetime-local"
                value={interviewDate}
                onChange={(event) => setInterviewDate(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview-venue">Venue</Label>
              <Input
                data-cy="interview-venue"
                id="interview-venue"
                value={interviewVenue}
                onChange={(event) => setInterviewVenue(event.target.value)}
                placeholder="A room at the school, or a video-call link"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview-outcome">Outcome</Label>
              <NativeSelect
                data-cy="interview-outcome"
                id="interview-outcome"
                value={interviewOutcome}
                onChange={(event) => setInterviewOutcome(event.target.value as InterviewOutcome | '')}
              >
                <option value="">Not yet held</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Whether the child did well in the interview itself. It's only a record — passing
                doesn't shortlist them and failing doesn't reject them, since a school may still
                have other reasons for its decision either way.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview-note">Note</Label>
              <Textarea
                data-cy="interview-note"
                id="interview-note"
                rows={3}
                value={interviewNote}
                onChange={(event) => setInterviewNote(event.target.value)}
                placeholder="Optional — added to this application's history"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              data-cy="admissions-admission-detail-interview-cancel"
              type="button"
              variant="outline"
              onClick={() => setInterviewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-cy="admissions-admission-detail-interview-save"
              onClick={() => void submitInterview()}
              loading={scheduleInterview.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scoreEditOpen} onOpenChange={setScoreEditOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Screening score</DialogTitle>
            <DialogDescription>
              Recorded against the application on its own — it doesn't change the status or notify
              the family.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-1.5">
              <Label htmlFor="edit-screening-score">Score</Label>
              <Input
                data-cy="edit-screening-score"
                id="edit-screening-score"
                type="number"
                min={0}
                max={100}
                value={scoreEditValue}
                onChange={(event) => setScoreEditValue(event.target.value)}
                placeholder="Out of 100"
              />
              <p className="text-xs text-muted-foreground">Leave blank to clear a score entered in error.</p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              data-cy="admissions-admission-detail-score-cancel"
              type="button"
              variant="outline"
              onClick={() => setScoreEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-cy="admissions-admission-detail-score-save"
              onClick={() => void submitScore()}
              loading={updateScreeningScore.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConvertApplicantDialog
        application={record}
        open={convertOpen}
        onOpenChange={setConvertOpen}
      />

      <LinkApplicationGuardianSheet
        applicationId={record.id}
        open={linkGuardianOpen}
        onOpenChange={setLinkGuardianOpen}
        excludeIds={record.linkedGuardians.map((link) => link.guardianId)}
      />

      <ConfirmDialog
        open={Boolean(pendingUnlinkGuardian)}
        onOpenChange={(open) => !open && setPendingUnlinkGuardian(null)}
        title="Unlink this guardian?"
        description="Removes the association with this application. The guardian record itself is not deleted."
        confirmLabel="Unlink"
        tone="danger"
        loading={unlinkGuardian.isPending}
        onConfirm={async () => {
          if (pendingUnlinkGuardian) await unlinkGuardian.mutateAsync(pendingUnlinkGuardian);
          setPendingUnlinkGuardian(null);
        }}
      />
    </PageContainer>
  );
}

function LinkApplicationGuardianSheet({
  applicationId,
  open,
  onOpenChange,
  excludeIds,
}: {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
}) {
  const link = useLinkApplicationGuardian(applicationId);
  const guardianOptions = useGuardianOptions().filter(
    (option) => !excludeIds.includes(option.value),
  );

  const form = useForm<AdmissionGuardianLinkValues>({
    resolver: zodResolver(admissionGuardianLinkSchema),
    defaultValues: {
      guardianId: '',
      relationship: 'GUARDIAN',
      isPrimaryContact: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await link.mutateAsync(values);
    form.reset();
    onOpenChange(false);
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Link a guardian"
      description="Pick an existing guardian record already known to the school — a sibling's parent, say. This does not grant them portal access or bill them; that still happens at enrollment."
      footer={
        <>
          <Button
            data-cy="admissions-admission-detail-link-guardian-cancel"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-cy="admissions-admission-detail-link-guardian-submit"
            onClick={onSubmit}
            loading={link.isPending}
          >
            Link guardian
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormError error={link.error} />

        <SelectField
          control={form.control}
          name="guardianId"
          label="Guardian"
          required
          options={guardianOptions}
          placeholder="Search guardians…"
        />

        <SelectField
          control={form.control}
          name="relationship"
          label="Relationship to the applicant"
          required
          options={[...RELATIONSHIP_OPTIONS]}
          native
        />

        <CheckboxField
          control={form.control}
          name="isPrimaryContact"
          label="Primary contact"
          description="Receives the admission decision, and is billed for fees once enrolled."
        />
      </form>
    </Sheet>
  );
}
