import { useEffect, useMemo, useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { useStudentGuardians, useLinkGuardian } from '@/features/students/api';
import { useCreateGuardian, useUpdateGuardian, useGuardian } from '@/features/guardians/api';
import { useSendInvoiceEmail } from './api';
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
 * Emails one invoice to a guardian.
 *
 * A student's guardian is the normal case, but this is also where a bursar
 * fills the gap when there isn't one yet: no guardian on file, or one with
 * no email, is fixed inline rather than sending the bursar away to the
 * Guardians screen first. Neither path ever grants parent-portal access —
 * that stays a deliberate, separate step (`GuardiansService.invite`), not a
 * side effect of sending a bill.
 */
export function EmailInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  studentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  studentId: string;
}) {
  const links = useStudentGuardians(open ? studentId : undefined);
  const createGuardian = useCreateGuardian();
  const linkGuardian = useLinkGuardian(studentId);
  const sendEmail = useSendInvoiceEmail(invoiceId);

  const [selectedGuardianId, setSelectedGuardianId] = useState<string | undefined>(undefined);
  const [emailDraft, setEmailDraft] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
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

  // A closed dialog reopened on a different invoice must not show a pick or
  // a half-typed draft left over from the last one.
  useEffect(() => {
    if (open) return;
    setSelectedGuardianId(undefined);
    setEmailDraft('');
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setError(null);
  }, [open]);

  const selected = guardians.find((g) => g.guardianId === selectedGuardianId);
  const needsEmail = Boolean(selected) && !selected!.guardianEmail;
  // Only fetched once actually needed — the full record, for the `version`
  // an email-only patch still has to carry.
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

  const sending = createGuardian.isPending || linkGuardian.isPending || updateGuardian.isPending || sendEmail.isPending;

  const send = async () => {
    setError(null);
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
        await sendEmail.mutateAsync(guardian.id);
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
      await sendEmail.mutateAsync(selected.guardianId);
      onOpenChange(false);
    } catch (thrown) {
      if (!isApiError(thrown)) throw thrown;
      setError(thrown);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Email invoice</DialogTitle>
          <DialogDescription>
            Sends this invoice to a guardian by email. This never creates them a parent-portal
            account — that stays a separate, deliberate step from their own profile.
          </DialogDescription>
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
                        data-cy="email-invoice-guardian"
                        type="radio"
                        name="email-invoice-guardian"
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
                          {link.isFinanciallyResponsible && (
                            <Badge tone="success">Pays fees</Badge>
                          )}
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
                  <Label htmlFor="email-invoice-new-email" required>
                    Email address for {selected!.guardianName}
                  </Label>
                  <Input
                    data-cy="email-invoice-new-email"
                    id="email-invoice-new-email"
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
                This student has no guardian on file yet. Add one to email the invoice to them.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email-invoice-first-name" required>
                    First name
                  </Label>
                  <Input
                    data-cy="email-invoice-first-name"
                    id="email-invoice-first-name"
                    value={newFirstName}
                    onChange={(event) => setNewFirstName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-invoice-last-name" required>
                    Surname
                  </Label>
                  <Input
                    data-cy="email-invoice-last-name"
                    id="email-invoice-last-name"
                    value={newLastName}
                    onChange={(event) => setNewLastName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-invoice-phone" required>
                    Phone number
                  </Label>
                  <Input
                    data-cy="email-invoice-phone"
                    id="email-invoice-phone"
                    type="tel"
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-invoice-email" required>
                    Email address
                  </Label>
                  <Input
                    data-cy="email-invoice-email"
                    id="email-invoice-email"
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button data-cy="email-invoice-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="email-invoice-send"
            loading={sending}
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
