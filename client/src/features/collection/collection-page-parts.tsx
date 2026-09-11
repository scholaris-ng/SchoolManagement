import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentPickupPersons, useStudentSearch } from '@/features/students/api';
import { useReleaseChild } from './api';
import type { CollectionEvent } from '@/types/people';
import { Avatar, Label } from '@/components/ui/primitives';
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

/**
 * Pieces used by `collection-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function ReleaseDialog({
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
                  isSearching={results.isSearching}
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
