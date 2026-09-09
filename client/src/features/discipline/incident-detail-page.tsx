import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Gavel, User } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useIncident, useTransitionIncident } from './api';
import type { IncidentStatus } from '@/types/behaviour';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/data/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const NEXT_STATUSES: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['REFERRED', 'DISMISSED'],
  REFERRED: ['UNDER_REVIEW', 'DISMISSED'],
  UNDER_REVIEW: ['ACTION_TAKEN', 'DISMISSED'],
  ACTION_TAKEN: ['RESOLVED'],
  RESOLVED: [],
  DISMISSED: [],
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  REPORTED: 'Reopen as reported',
  REFERRED: 'Refer for review',
  UNDER_REVIEW: 'Begin review',
  ACTION_TAKEN: 'Record action taken',
  RESOLVED: 'Mark resolved',
  DISMISSED: 'Dismiss',
};

const ACTION_TYPES = [
  'WARNING',
  'DETENTION',
  'SUSPENSION',
  'PARENT_MEETING',
  'COUNSELLING',
  'OTHER',
];

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const incident = useIncident(id);
  const transition = useTransitionIncident(id ?? '');

  const [pending, setPending] = useState<IncidentStatus | null>(null);
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [notifyGuardian, setNotifyGuardian] = useState(true);
  const [actionType, setActionType] = useState('WARNING');
  const [actionDescription, setActionDescription] = useState('');
  const [actionStart, setActionStart] = useState('');
  const [actionEnd, setActionEnd] = useState('');

  if (incident.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading incident…" />
      </PageContainer>
    );
  }

  if (incident.isError || !incident.data) {
    return (
      <PageContainer>
        <ErrorState error={incident.error} onRetry={() => void incident.refetch()} />
      </PageContainer>
    );
  }

  const record = incident.data;
  const canReview = can('discipline.review');
  const nextStatuses = canReview ? NEXT_STATUSES[record.status] : [];

  const submit = async () => {
    if (!pending) return;
    await transition.mutateAsync({
      status: pending,
      note: note.trim() || undefined,
      resolution: pending === 'RESOLVED' ? resolution.trim() || undefined : undefined,
      notifyGuardian,
      action:
        pending === 'ACTION_TAKEN'
          ? {
              type: actionType,
              description: actionDescription.trim(),
              startDate: actionStart || undefined,
              endDate: actionEnd || undefined,
            }
          : undefined,
    });
    setPending(null);
    setNote('');
  };

  return (
    <PageContainer>
      <PageHeader
        title={record.category}
        description={`${record.referenceNo} · ${formatDateTime(record.occurredAt)}`}
        breadcrumbs={[
          { label: 'Discipline', to: '/discipline' },
          { label: record.referenceNo },
        ]}
        meta={
          <>
            <StatusBadge status={record.status} />
            <StatusBadge status={record.severity} />
            {record.guardianNotified ? (
              <Badge tone="success">Guardian notified</Badge>
            ) : (
              <Badge tone="warning">Guardian not notified</Badge>
            )}
          </>
        }
        actions={
          <>
            <Button data-cy="discipline-incident-detail-student-record" variant="outline" asChild>
              <Link to={`/students/${record.studentId}`}>
                <User />
                Student record
              </Link>
            </Button>
            {nextStatuses.map((status) => (
              <Button
                key={status}
                data-cy={`incident-transition-${status.toLowerCase()}`}
                variant={status === 'DISMISSED' ? 'outline' : 'primary'}
                onClick={() => {
                  setPending(status);
                  setNote('');
                }}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The report</CardTitle>
              <CardDescription>
                Filed by {record.reportedByName}
                {record.location ? ` · ${record.location}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-line text-sm">{record.description}</p>
              <dl className="grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
                <Field label="Student" value={record.studentName} />
                <Field label="Class" value={record.className ?? '—'} />
                <Field label="Occurred" value={formatDateTime(record.occurredAt)} />
                <Field label="Severity" value={humanizeEnum(record.severity)} />
              </dl>
            </CardContent>
          </Card>

          {record.actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Actions taken</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {record.actions.map((action) => (
                    <li key={action.id} className="px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="primary">{humanizeEnum(action.type)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {action.issuedByName} · {formatDateTime(action.issuedAt)}
                        </span>
                      </div>
                      <p className="mt-1">{action.description}</p>
                      {(action.startDate || action.endDate) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {action.startDate && formatDate(action.startDate)}
                          {action.endDate && ` – ${formatDate(action.endDate)}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {record.evidence.length === 0 ? (
                <EmptyState compact icon={<FileText />} title="No evidence attached" />
              ) : (
                <ul className="divide-y divide-border">
                  {record.evidence.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <FileText
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      {file.downloadUrl && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          data-cy={`incident-evidence-download-${file.name}`}
                        >
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Download ${file.name}`}
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
          {record.resolution && (
            <Card className="border-success/40 bg-success-subtle">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>{record.resolution}</p>
                {record.resolvedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(record.resolvedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Appended, never rewritten.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {[...record.timeline].reverse().map((event) => (
                  <li key={event.id} className="flex gap-3 px-5 py-3 text-sm">
                    <Gavel
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

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{pending ? STATUS_LABEL[pending] : ''}</DialogTitle>
            <DialogDescription>
              This is added to the incident&rsquo;s history with your name and the time.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {pending === 'ACTION_TAKEN' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="action-type" required>
                    Action
                  </Label>
                  <NativeSelect
                    data-cy="action-type"
                    id="action-type"
                    value={actionType}
                    onChange={(event) => setActionType(event.target.value)}
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {humanizeEnum(type)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="action-description" required>
                    Details
                  </Label>
                  <Textarea
                    data-cy="action-description"
                    id="action-description"
                    rows={3}
                    value={actionDescription}
                    onChange={(event) => setActionDescription(event.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="action-start">From</Label>
                    <Input
                      data-cy="action-start"
                      id="action-start"
                      type="date"
                      value={actionStart}
                      onChange={(event) => setActionStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="action-end">Until</Label>
                    <Input
                      data-cy="action-end"
                      id="action-end"
                      type="date"
                      value={actionEnd}
                      onChange={(event) => setActionEnd(event.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {pending === 'RESOLVED' && (
              <div className="space-y-1.5">
                <Label htmlFor="incident-resolution" required>
                  How it was resolved
                </Label>
                <Textarea
                  data-cy="incident-resolution"
                  id="incident-resolution"
                  rows={3}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="incident-note">Note</Label>
              <Textarea
                data-cy="incident-note"
                id="incident-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                data-cy="discipline-incident-detail-notify-guardian"
                type="checkbox"
                checked={notifyGuardian}
                onChange={(event) => setNotifyGuardian(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                <span className="font-medium">Notify the guardian</span>
                <span className="block text-xs text-muted-foreground">
                  Sends a message through the parent portal and the school&rsquo;s configured
                  channels.
                </span>
              </span>
            </label>
          </DialogBody>

          <DialogFooter>
            <Button data-cy="discipline-incident-detail-cancel" variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              data-cy="discipline-incident-detail-confirm"
              loading={transition.isPending}
              disabled={
                (pending === 'ACTION_TAKEN' && !actionDescription.trim()) ||
                (pending === 'RESOLVED' && !resolution.trim())
              }
              onClick={() => void submit()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
