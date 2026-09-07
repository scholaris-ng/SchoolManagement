import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Heart, Mail, Phone, Plus, Unlink } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { useGuardianOptions } from '@/features/guardians/api';
import { useLinkGuardian, useStudentGuardians, useUnlinkGuardian } from '../api';
import { guardianLinkSchema, type GuardianLinkValues } from '../schema';
import { Card, CardContent, Badge, Avatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/dialog';
import { CheckboxField, SelectField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';
import { PermissionGate } from '@/components/guards/permission-gate';

const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * The many-to-many relationship, from the student's side. One child may have
 * several guardians, each with different responsibilities — the qualities live
 * on the link, not on either party.
 */
export function StudentGuardiansTab({ studentId }: { studentId: string }) {
  const links = useStudentGuardians(studentId);
  const unlink = useUnlinkGuardian(studentId);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);

  if (links.isPending) return <LoadingState label="Loading guardians…" />;
  if (links.isError) return <ErrorState error={links.error} onRetry={() => void links.refetch()} />;

  const rows = links.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate require="guardian.manage">
          <Button onClick={() => setLinkOpen(true)}>
            <Plus />
            Link a guardian
          </Button>
        </PermissionGate>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart />}
            title="No guardians linked"
            description="Link a parent or guardian so they can see this child in their portal, receive alerts and be billed."
            action={
              <PermissionGate require="guardian.manage">
                <Button onClick={() => setLinkOpen(true)}>
                  <Plus />
                  Link a guardian
                </Button>
              </PermissionGate>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((link) => (
            <Card key={link.id}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <Avatar name={link.guardianName} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/guardians/${link.guardianId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {link.guardianName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {humanizeEnum(link.relationship)}
                    </p>

                    <div className="mt-2 space-y-1 text-sm">
                      <a
                        href={`tel:${link.guardianPhone}`}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {link.guardianPhone}
                      </a>
                      <a
                        href={`mailto:${link.guardianEmail}`}
                        className="flex items-center gap-1.5 truncate text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{link.guardianEmail}</span>
                      </a>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {link.isPrimaryContact && <Badge tone="primary">Primary contact</Badge>}
                      {link.isEmergencyContact && <Badge tone="danger">Emergency</Badge>}
                      {link.isFinanciallyResponsible && <Badge tone="success">Pays fees</Badge>}
                      {link.canPickUp && <Badge tone="info">Can collect</Badge>}
                    </div>
                  </div>
                  <PermissionGate require="guardian.manage">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingUnlink(link.id)}
                      aria-label={`Unlink ${link.guardianName}`}
                    >
                      <Unlink />
                    </Button>
                  </PermissionGate>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LinkGuardianSheet
        studentId={studentId}
        open={linkOpen}
        onOpenChange={setLinkOpen}
        excludeIds={rows.map((row) => row.guardianId)}
      />

      <ConfirmDialog
        open={Boolean(pendingUnlink)}
        onOpenChange={(open) => !open && setPendingUnlink(null)}
        title="Unlink this guardian?"
        description="They will lose access to this child in their parent portal. The guardian record itself is not deleted."
        confirmLabel="Unlink"
        tone="danger"
        loading={unlink.isPending}
        onConfirm={async () => {
          if (pendingUnlink) await unlink.mutateAsync(pendingUnlink);
          setPendingUnlink(null);
        }}
      />
    </div>
  );
}

function LinkGuardianSheet({
  studentId,
  open,
  onOpenChange,
  excludeIds,
}: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
}) {
  const link = useLinkGuardian(studentId);
  const guardianOptions = useGuardianOptions().filter(
    (option) => !excludeIds.includes(option.value),
  );

  const form = useForm<GuardianLinkValues>({
    resolver: zodResolver(guardianLinkSchema),
    defaultValues: {
      guardianId: '',
      relationship: 'GUARDIAN',
      isPrimaryContact: false,
      isEmergencyContact: false,
      isFinanciallyResponsible: false,
      canPickUp: true,
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
      description="Pick an existing guardian, or create one first from the Guardians page."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={link.isPending}>
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
          label="Relationship to the student"
          required
          options={RELATIONSHIP_OPTIONS}
          native
        />

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Responsibilities</legend>
          <CheckboxField
            control={form.control}
            name="isPrimaryContact"
            label="Primary contact"
            description="The first person the school calls about this child."
          />
          <CheckboxField
            control={form.control}
            name="isEmergencyContact"
            label="Emergency contact"
          />
          <CheckboxField
            control={form.control}
            name="isFinanciallyResponsible"
            label="Financially responsible"
            description="Receives invoices and fee reminders for this child."
          />
          <CheckboxField
            control={form.control}
            name="canPickUp"
            label="Authorised to collect the child"
          />
        </fieldset>
      </form>
    </Sheet>
  );
}
