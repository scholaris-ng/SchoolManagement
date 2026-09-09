import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentPickupPersons, useStudentSearch } from '@/features/students/api';
import { useCollectionEvents, useReleaseChild } from './api';
import type { CollectionEvent } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { Avatar, Badge, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

/**
 * Child collection.
 *
 * The safeguarding question this answers is simple and serious: did the right
 * adult take this child? So the release flow starts from the authorised list,
 * requires an explicit override for anyone not on it, and writes an immutable
 * record either way (spec section 12).
 */
export function CollectionPage() {
  const navigate = useNavigate();
  const list = useListQuery({ defaultPageSize: 25 });
  const events = useCollectionEvents(list.query);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const columns = useMemo<Column<CollectionEvent>[]>(
    () => [
      {
        id: 'student',
        header: 'Child',
        cell: (event) => (
          <div className="min-w-0">
            <Link
              to={`/students/${event.studentId}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              {event.studentName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {event.studentAdmissionNo}
              {event.className ? ` · ${event.className}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'collector',
        header: 'Collected by',
        cell: (event) => (
          <div className="min-w-0">
            <p className="truncate">{event.pickupPersonName}</p>
            <p className="truncate text-xs text-muted-foreground">{event.relationship}</p>
          </div>
        ),
      },
      {
        id: 'method',
        header: 'How',
        hideOnMobile: true,
        cell: (event) => <Badge tone="neutral">{humanizeEnum(event.method)}</Badge>,
      },
      {
        id: 'released',
        header: 'Released',
        cell: (event) => (
          <div className="min-w-0 text-sm">
            <p>{formatDateTime(event.releasedAt)}</p>
            <p className="truncate text-xs text-muted-foreground">by {event.releasedByName}</p>
          </div>
        ),
      },
      {
        id: 'notified',
        header: 'Guardian told',
        align: 'center',
        hideOnMobile: true,
        cell: (event) =>
          event.parentNotified ? (
            <Badge tone="success">Notified</Badge>
          ) : (
            <Badge tone="neutral">No</Badge>
          ),
      },
      {
        id: 'note',
        header: 'Note',
        hideOnMobile: true,
        cell: (event) =>
          event.note ? (
            <span className="line-clamp-2 max-w-xs text-xs">{event.note}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Child collection"
        description="Who collected which child, when, and which member of staff released them."
        breadcrumbs={[{ label: 'Behaviour & safety' }, { label: 'Child collection' }]}
        actions={
          <PermissionGate require="collection.manage">
            <Button data-cy="collection-release-a-child" onClick={() => setReleaseOpen(true)}>
              <UserCheck />
              Release a child
            </Button>
          </PermissionGate>
        }
      />

      <Alert tone="info" title="This log cannot be edited">
        Collection records are written once and kept. If something was recorded in error, add a new
        entry explaining it rather than trying to change history.
      </Alert>

      <DataTable

        data-cy="collection-table"
        caption="Collection log: child, collector, time and releasing staff member"
        data={events.data?.items}
        meta={events.data?.meta}
        columns={columns}
        rowKey={(event) => event.id}
        isLoading={events.isPending}
        isFetching={events.isFetching}
        error={events.error}
        onRetry={() => void events.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(event) => navigate(`/students/${event.studentId}`)}
        emptyIcon={<Bus />}
        emptyTitle="No collections recorded yet"
        emptyDescription="Records appear here as children are released at the gate."
      />

      <ReleaseDialog open={releaseOpen} onOpenChange={setReleaseOpen} />
    </PageContainer>
  );
}

function ReleaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const release = useReleaseChild();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const results = useStudentSearch(query, { enabled: query.length >= 2 });
  const pickup = useStudentPickupPersons(student?.id);

  const [pickupPersonId, setPickupPersonId] = useState('');
  const [overrideName, setOverrideName] = useState('');
  const [overrideRelationship, setOverrideRelationship] = useState('');
  const [method, setMethod] = useState<CollectionEvent['method']>('GATE');
  const [note, setNote] = useState('');

  const authorised = (pickup.data?.persons ?? []).filter(
    (person) => person.authorizationStatus === 'AUTHORIZED',
  );
  const isOverride = pickupPersonId === 'OTHER';
  const selectedPerson = authorised.find((person) => person.id === pickupPersonId);

  const valid = Boolean(
    student &&
      (isOverride ? overrideName.trim() && overrideRelationship.trim() && note.trim() : selectedPerson),
  );

  const submit = async () => {
    if (!student || !valid) return;
    await release.mutateAsync({
      studentId: student.id,
      pickupPersonId: isOverride ? null : pickupPersonId,
      pickupPersonName: isOverride ? overrideName.trim() : (selectedPerson?.name ?? ''),
      relationship: isOverride ? overrideRelationship.trim() : (selectedPerson?.relationship ?? ''),
      method,
      note: note.trim() || undefined,
    });
    onOpenChange(false);
    setStudent(null);
    setPickupPersonId('');
    setNote('');
    setOverrideName('');
    setOverrideRelationship('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Release a child</DialogTitle>
          <DialogDescription>
            Recorded against your name — {user?.displayName} — and the time.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="release-student" required>
              Child
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button
                  data-cy="collection-change"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStudent(null);
                    setPickupPersonId('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  data-cy="collection-query"
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search by name or admission number…"
                />
                {results.data && results.data.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {results.data.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          data-cy={`collection-student-result-${match.id}`}
                          onClick={() => setStudent({ id: match.id, name: match.fullName })}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {match.fullName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {match.admissionNo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {student && (
            <>
              {pickup.isPending ? (
                <LoadingState label="Loading the authorised list…" />
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Who is collecting?</legend>

                  {authorised.length === 0 && (
                    <Alert tone="warning" title="Nobody is authorised for this child">
                      No approved collector is on file. Releasing anyway requires a note explaining
                      who they are and who approved it.
                    </Alert>
                  )}

                  {authorised.map((person) => (
                    <label
                      key={person.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 text-sm hover:bg-accent/40"
                    >
                      <input
                        data-cy="collection-id"
                        type="radio"
                        name="collector"
                        checked={pickupPersonId === person.id}
                        onChange={() => setPickupPersonId(person.id)}
                        className="size-4 shrink-0"
                      />
                      <Avatar name={person.name} src={person.photoUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{person.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.relationship} · {person.phone}
                        </span>
                      </span>
                      <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                    </label>
                  ))}

                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border p-2.5 text-sm hover:bg-accent/40">
                    <input
                      data-cy="collection-is-override"
                      type="radio"
                      name="collector"
                      checked={isOverride}
                      onChange={() => setPickupPersonId('OTHER')}
                      className="size-4 shrink-0"
                    />
                    <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="font-medium">Someone not on the list</span>
                  </label>
                </fieldset>
              )}

              {isOverride && (
                <div className="space-y-3 rounded-md border border-warning/40 bg-warning-subtle p-3">
                  <Alert tone="warning" title="Releasing to an unauthorised adult">
                    Only do this when a guardian has confirmed it directly. The override is recorded
                    permanently against your name.
                  </Alert>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="override-name" required>
                        Their name
                      </Label>
                      <SearchInput
                        data-cy="collection-override-name"
                        value={overrideName}
                        onValueChange={setOverrideName}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="override-relationship" required>
                        Relationship
                      </Label>
                      <SearchInput
                        data-cy="collection-override-relationship"
                        value={overrideRelationship}
                        onValueChange={setOverrideRelationship}
                        placeholder="e.g. Aunt"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="release-method">How they left</Label>
                <NativeSelect
                  data-cy="release-method"
                  id="release-method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as CollectionEvent['method'])}
                >
                  <option value="GATE">Collected at the gate</option>
                  <option value="BUS">School bus</option>
                  <option value="SELF">Walked home alone</option>
                  <option value="OTHER">Other</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="release-note" required={isOverride}>
                  Note
                </Label>
                <Textarea
                  data-cy="release-note"
                  id="release-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    isOverride
                      ? 'Required: who authorised this, and how you confirmed it.'
                      : 'Optional.'
                  }
                />
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button data-cy="collection-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-cy="collection-record-release" loading={release.isPending} disabled={!valid} onClick={() => void submit()}>
            Record release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
