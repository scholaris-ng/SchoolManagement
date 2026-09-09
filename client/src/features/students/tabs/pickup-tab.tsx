import { useState } from 'react';
import { Bus, Plus, ShieldCheck, ShieldX } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useSavePickupPerson, useStudentPickupPersons } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/dialog';
import { FileUpload } from '@/components/forms/file-upload';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { PickupPerson } from '@/types/people';

/**
 * Child collection safety (research feature 19).
 *
 * Two things are tracked separately: who is *authorised* to collect this child,
 * and who actually did. The second list is an immutable history — it is the
 * record that matters if a child goes missing between home and school.
 */
export function StudentPickupTab({ studentId }: { studentId: string }) {
  const pickup = useStudentPickupPersons(studentId);
  const [editing, setEditing] = useState<PickupPerson | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (pickup.isPending) return <LoadingState label="Loading collection details…" />;
  if (pickup.isError) return <ErrorState error={pickup.error} onRetry={() => void pickup.refetch()} />;

  const persons = pickup.data?.persons ?? [];
  const events = pickup.data?.recentEvents ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Authorised to collect</CardTitle>
              <CardDescription>
                Only people on this list may take the child from the school gate.
              </CardDescription>
            </div>
            <PermissionGate require="collection.manage">
              <Button
                data-cy="tabs-pickup-tab-add"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}
              >
                <Plus />
                Add
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {persons.length === 0 ? (
            <EmptyState
              compact
              icon={<ShieldX />}
              title="Nobody authorised yet"
              description="Add the people a guardian has approved to collect this child."
            />
          ) : (
            <ul className="divide-y divide-border">
              {persons.map((person) => (
                <li key={person.id} className="flex items-center gap-3 p-4">
                  <Avatar name={person.name} src={person.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {person.relationship} · {person.phone}
                    </p>
                    {person.authorizedByName && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Approved by {person.authorizedByName}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={person.authorizationStatus} />
                  <PermissionGate require="collection.manage">
                    <Button
                      data-cy="tabs-pickup-tab-edit"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(person);
                        setSheetOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </PermissionGate>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collection history</CardTitle>
          <CardDescription>
            A permanent record of every time this child left the premises.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <EmptyState
              compact
              icon={<Bus />}
              title="No collections recorded"
              description="Each release is logged with who collected the child and which staff member released them."
            />
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-success-subtle text-success">
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Collected by {event.pickupPersonName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.relationship} · released by {event.releasedByName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(event.releasedAt)}
                      </p>
                      {event.note && (
                        <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone="neutral">{event.method}</Badge>
                      {event.parentNotified && <Badge tone="success">Parent told</Badge>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PickupPersonSheet
        studentId={studentId}
        person={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

function PickupPersonSheet({
  studentId,
  person,
  open,
  onOpenChange,
}: {
  studentId: string;
  person: PickupPerson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSavePickupPerson(studentId);
  const [values, setValues] = useState<Partial<PickupPerson>>({});

  const current = { ...person, ...values };

  const submit = async () => {
    await save.mutateAsync({
      id: person?.id,
      values: {
        name: current.name ?? '',
        relationship: current.relationship ?? '',
        phone: current.phone ?? '',
        photoUrl: current.photoUrl ?? null,
        authorizationStatus: current.authorizationStatus ?? 'AUTHORIZED',
        note: current.note ?? null,
      },
    });
    setValues({});
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setValues({});
        onOpenChange(next);
      }}
      title={person ? 'Edit authorised person' : 'Add an authorised person'}
      description="A photograph helps gate staff recognise the person collecting the child."
      width="sm"
      footer={
        <>
          <Button data-cy="tabs-pickup-tab-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-cy="tabs-pickup-tab-save" onClick={() => void submit()} loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="info">
          Only add someone a guardian has explicitly approved. Every collection is logged against
          this record.
        </Alert>

        <FileUpload
          variant="avatar"
          preset="image"
          purpose="pickup-person-photo"
          entityId={studentId}
          value={current.photoUrl ? { url: current.photoUrl } : null}
          onUploaded={(file) => setValues((v) => ({ ...v, photoUrl: file.downloadUrl }))}
          onRemove={() => setValues((v) => ({ ...v, photoUrl: null }))}
        />

        <div className="space-y-1.5">
          <Label htmlFor="pickup-name" required>
            Full name
          </Label>
          <Input
            data-cy="pickup-name"
            id="pickup-name"
            value={current.name ?? ''}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pickup-relationship" required>
            Relationship to the child
          </Label>
          <Input
            data-cy="pickup-relationship"
            id="pickup-relationship"
            placeholder="e.g. Aunt, driver, grandparent"
            value={current.relationship ?? ''}
            onChange={(event) => setValues((v) => ({ ...v, relationship: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pickup-phone" required>
            Phone number
          </Label>
          <Input
            data-cy="pickup-phone"
            id="pickup-phone"
            type="tel"
            value={current.phone ?? ''}
            onChange={(event) => setValues((v) => ({ ...v, phone: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pickup-status">Authorisation</Label>
          <NativeSelect
            data-cy="pickup-status"
            id="pickup-status"
            value={current.authorizationStatus ?? 'AUTHORIZED'}
            onChange={(event) =>
              setValues((v) => ({
                ...v,
                authorizationStatus: event.target.value as PickupPerson['authorizationStatus'],
              }))
            }
          >
            <option value="AUTHORIZED">Authorised</option>
            <option value="PENDING">Pending approval</option>
            <option value="REVOKED">Revoked</option>
          </NativeSelect>
        </div>
      </div>
    </Sheet>
  );
}
