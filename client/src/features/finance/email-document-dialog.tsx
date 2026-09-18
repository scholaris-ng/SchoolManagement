import { useEffect, useMemo, useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { useStudentGuardians, useLinkGuardian } from '@/features/students/api';
import { useCreateGuardian, useUpdateGuardian, useGuardian } from '@/features/guardians/api';
import { Label, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/ui/feedback';
import { FormError } from '@/components/forms/form-actions';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Emails one finance document — an invoice, a receipt — to a guardian.
 *
 * A student's guardian is the normal case, but this is also where a bursar
 * fills the gap when there isn't one yet: no guardian on file, or one with no
 * email, is fixed inline rather than sending the bursar away to the Guardians
 * screen first. Neither path ever grants parent-portal access — that stays a
 * deliberate, separate step (`GuardiansService.invite`), not a side effect of
 * sending a bill.
 *
 * What is sent, and how, belongs to the caller (`onSend`); everything about
 * choosing or creating the recipient belongs here, once, so an invoice and a
 * receipt cannot drift apart in how they treat a guardian with no email.
 */
export function EmailDocumentDialog({
  open,
  onOpenChange,
  studentId,
  title,
  description,
  cyPrefix,
  onSend,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  title: string;
  description: React.ReactNode;
  /** Prefix for the `data-cy` hooks, e.g. `email-invoice`. */
  cyPrefix: string;
  /** Sends the document to this guardian. An API error is shown in the dialog. */
  onSend: (guardianId: string) => Promise<unknown>;
  /** Options specific to the document, rendered under the recipient. */
  children?: React.ReactNode;
}) {
  const links = useStudentGuardians(open ? studentId : undefined);
  const createGuardian = useCreateGuardian();
  const linkGuardian = useLinkGuardian(studentId);

  const [selectedGuardianId, setSelectedGuardianId] = useState<string | undefined>(undefined);
  const [emailDraft, setEmailDraft] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const guardians = useMemo(() => links.data ?? [], [links.data]);
  const hasGuardians = guardians.length > 0;

  // Picks a sensible default once the guardians load: whoever is actually
  // billed for this child, the same field the guardians tab shows as "Pays
  // fees" — falling back to the primary contact, then whoever is first.
  useEffect(() => {
    if (!open || selectedGuardianId || guardians.length === 0) return;
    const preferred =
      guardians.find((g) => g.isFinanciallyResponsible) ??
      guardians.find((g) => g.isPrimaryContact) ??
      guardians[0];
    setSelectedGuardianId(preferred.guardianId);
  }, [open, guardians, selectedGuardianId]);

  // A closed dialog reopened on a different document must not show a pick or a
  // half-typed draft left over from the last one.
  useEffect(() => {
    if (open) return;
    setSelectedGuardianId(undefined);
    setEmailDraft('');
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setBusy(false);
    setError(null);
  }, [open]);

  const selected = guardians.find((g) => g.guardianId === selectedGuardianId);
  const needsEmail = Boolean(selected) && !selected!.guardianEmail;
  // Only fetched once actually needed — the full record, for the `version` an
  // email-only patch still has to carry.
  const selectedFull = useGuardian(needsEmail ? selectedGuardianId : undefined);
  const updateGuardian = useUpdateGuardian(selectedGuardianId ?? '');

  const canSendExisting = Boolean(
    selected &&
      (selected.guardianEmail ||
        (EMAIL_RE.test(emailDraft.trim()) && Boolean(selectedFull.data))),
  );
  const canSendNew =
    !hasGuardians &&
    Boolean(newFirstName.trim() && newLastName.trim() && newPhone.trim()) &&
    EMAIL_RE.test(newEmail.trim());

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!hasGuardians) {
        const guardian = await createGuardian.mutateAsync({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          grantPortalAccess: false,
        });
        await linkGuardian.mutateAsync({
          guardianId: guardian.id,
          relationship: 'GUARDIAN',
          isPrimaryContact: true,
          isEmergencyContact: false,
          isFinanciallyResponsible: true,
          canPickUp: false,
        });
        await onSend(guardian.id);
        onOpenChange(false);
        return;
      }

      if (!selected) return;
      if (needsEmail) {
        if (!selectedFull.data) return;
        await updateGuardian.mutateAsync({
          values: { email: emailDraft.trim() },
          version: selectedFull.data.version,
        });
      }
      await onSend(selected.guardianId);
      onOpenChange(false);
    } catch (thrown) {
      if (!isApiError(thrown)) throw thrown;
      setError(thrown);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FormError error={error} />

          {links.isPending ? (
            <LoadingState label="Loading guardians…" />
          ) : links.isError ? (
            <ErrorState error={links.error} onRetry={() => void links.refetch()} />
          ) : hasGuardians ? (
            <div className="space-y-3">
              <ul className="divide-y divide-border rounded-md border border-border">
                {guardians.map((link) => (
                  <li key={link.guardianId} className="px-3 py-2 text-sm">
                    <label className="flex items-start gap-2">
                      <input
                        data-cy={`${cyPrefix}-guardian`}
                        type="radio"
                        name={`${cyPrefix}-guardian`}
                        className="mt-0.5 size-4 shrink-0 border-input"
                        checked={selectedGuardianId === link.guardianId}
                        onChange={() => {
                          setSelectedGuardianId(link.guardianId);
                          setEmailDraft('');
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{link.guardianName}</span>
                          <span className="text-xs text-muted-foreground">
                            {humanizeEnum(link.relationship)}
                          </span>
                          {link.isFinanciallyResponsible && <Badge tone="success">Pays fees</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {link.guardianEmail || 'No email on file'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {needsEmail && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${cyPrefix}-new-email`} required>
                    Email address for {selected!.guardianName}
                  </Label>
                  <Input
                    data-cy={`${cyPrefix}-new-email`}
                    id={`${cyPrefix}-new-email`}
                    type="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This student has no guardian on file yet. Add one to email this to them.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${cyPrefix}-first-name`} required>
                    First name
                  </Label>
                  <Input
                    data-cy={`${cyPrefix}-first-name`}
                    id={`${cyPrefix}-first-name`}
                    value={newFirstName}
                    onChange={(event) => setNewFirstName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${cyPrefix}-last-name`} required>
                    Surname
                  </Label>
                  <Input
                    data-cy={`${cyPrefix}-last-name`}
                    id={`${cyPrefix}-last-name`}
                    value={newLastName}
                    onChange={(event) => setNewLastName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${cyPrefix}-phone`} required>
                    Phone number
                  </Label>
                  <Input
                    data-cy={`${cyPrefix}-phone`}
                    id={`${cyPrefix}-phone`}
                    type="tel"
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${cyPrefix}-email`} required>
                    Email address
                  </Label>
                  <Input
                    data-cy={`${cyPrefix}-email`}
                    id={`${cyPrefix}-email`}
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {children}
        </DialogBody>

        <DialogFooter>
          <Button data-cy={`${cyPrefix}-cancel`} variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy={`${cyPrefix}-send`}
            loading={busy}
            disabled={!canSendExisting && !canSendNew}
            onClick={() => void send()}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
