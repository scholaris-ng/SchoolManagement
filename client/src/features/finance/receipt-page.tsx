import { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, MessageCircle, Printer } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { env } from '@/lib/env';
import { isApiError } from '@/lib/api-error';
import { toast } from '@/lib/toast-bus';
import { useStudentGuardians, useLinkGuardian } from '@/features/students/api';
import { useCreateGuardian, useUpdateGuardian, useGuardian } from '@/features/guardians/api';
import { useReceipt, useSendReceiptEmail } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, Label, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode } from '@/components/data/qr-code';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
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

/**
 * A printable receipt.
 *
 * Parents in Nigeria routinely need a physical receipt for a bursar, an
 * employer or their own records, so this prints cleanly onto a half sheet and
 * carries a verification code the school can check later.
 */
export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const receipt = useReceipt(paymentId);
  const [showItems, setShowItems] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const breadcrumbs = [
    { label: 'Finance', to: '/finance' },
    { label: 'Payments', to: '/finance/payments' },
  ];

  if (receipt.isPending) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader loading title="" breadcrumbs={breadcrumbs} />
        </div>
        <LoadingState label="Loading receipt…" />
      </PageContainer>
    );
  }

  if (receipt.isError || !receipt.data) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader title="Receipt" breadcrumbs={breadcrumbs} />
        </div>
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      </PageContainer>
    );
  }

  const record = receipt.data;
  const verifyUrl = `${env.appUrl}/verify/${record.verificationCode}`;

  return (
    <>
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader
            title={`Receipt ${record.receiptNo}`}
            description={`${record.studentName} · ${formatDateTime(record.paidAt)}`}
            breadcrumbs={[...breadcrumbs, { label: record.receiptNo }]}
            actions={
              <>
                <Button
                  data-cy="finance-receipt-whatsapp"
                  variant="outline"
                  onClick={() =>
                    toast.info('Coming soon', {
                      description: "Sending receipts straight to a guardian's WhatsApp is on the way.",
                    })
                  }
                >
                  <MessageCircle />
                  Send to WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setEmailOpen(true)}>
                  <Mail />
                  Email receipt
                </Button>
                <Button data-cy="finance-receipt-print" onClick={() => window.print()}>
                  <Printer />
                  Print
                </Button>
              </>
            }
          />
        </div>

      {record.allocations.some((allocation) => allocation.lines.length > 0) && (
        <label className="no-print flex items-center gap-2 text-sm text-muted-foreground">
          <input
            data-cy="finance-receipt-show-items"
            type="checkbox"
            checked={showItems}
            onChange={(event) => setShowItems(event.target.checked)}
            className="size-4 rounded border-input"
          />
          Show each invoice's charges on the receipt
        </label>
      )}

      <Card className="print-page">
        <CardContent className="space-y-5 pt-6">
          <header className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
            {record.schoolLogoUrl ? (
              <img src={record.schoolLogoUrl} alt="" className="size-14 object-contain" />
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{record.schoolName}</h2>
              <p className="text-sm text-muted-foreground">{record.schoolAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
              <p className="font-mono font-semibold">{record.receiptNo}</p>
            </div>
          </header>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Received from" value={record.studentName} />
            <Field label="Admission number" value={record.admissionNo} />
            <Field label="Class" value={record.className ?? '—'} />
            <Field label="Date" value={formatDateTime(record.paidAt)} />
            <Field label="Method" value={humanizeEnum(record.method)} />
            <Field label="Received by" value={record.receivedByName} />
          </dl>

          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount received</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(record.amount, 'NGN')}</p>
            <p className="mt-0.5 text-sm capitalize text-muted-foreground">
              {record.amountInWords}
            </p>
          </div>

          {record.allocations.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Applied to
              </p>
              <table className="w-full text-sm">
                <caption className="sr-only">Invoices this payment was applied to</caption>
                <tbody className="divide-y divide-border">
                  {record.allocations.map((allocation, index) => (
                    <Fragment key={index}>
                      <tr>
                        <td className="py-1.5 font-mono text-xs">{allocation.invoiceNo}</td>
                        <td className="py-1.5">{allocation.description}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatCurrency(allocation.amount, 'NGN', { showDecimals: false })}
                        </td>
                      </tr>
                      {showItems &&
                        allocation.lines.map((line, lineIndex) => (
                          <tr key={lineIndex} className="text-xs text-muted-foreground">
                            <td className="py-1"></td>
                            <td className="py-1 pl-4">
                              {line.description}
                              {line.isOptional ? ' (optional)' : ''}
                            </td>
                            <td className="py-1 text-right tabular-nums">
                              {formatCurrency(line.amount, 'NGN', { showDecimals: false })}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Balance after this payment: </span>
                <span
                  className={`font-semibold tabular-nums ${record.balanceAfter > 0 ? 'text-danger' : 'text-success'}`}
                >
                  {formatCurrency(record.balanceAfter, 'NGN')}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Verification code <span className="font-mono">{record.verificationCode}</span>
              </p>
              <p className="break-all text-xs text-muted-foreground">{verifyUrl}</p>
            </div>
            <QrCode value={verifyUrl} size={84} label="Scan to verify this receipt" />
          </div>
        </CardContent>
      </Card>
    </PageContainer>
      <EmailReceiptDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentId={record.paymentId}
        studentId={record.studentId}
      />
    </>
  );
}

function EmailReceiptDialog({
  open,
  onOpenChange,
  paymentId,
  studentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  studentId: string;
}) {
  const links = useStudentGuardians(open ? studentId : undefined);
  const createGuardian = useCreateGuardian();
  const linkGuardian = useLinkGuardian(studentId);
  const sendEmail = useSendReceiptEmail(paymentId);
  const [selectedGuardianId, setSelectedGuardianId] = useState<string | undefined>(undefined);
  const [emailDraft, setEmailDraft] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [includeCharges, setIncludeCharges] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const guardians = useMemo(() => links.data ?? [], [links.data]);
  const hasGuardians = guardians.length > 0;

  useEffect(() => {
    if (!open || selectedGuardianId || guardians.length === 0) return;
    const preferred =
      guardians.find((g) => g.isFinanciallyResponsible) ??
      guardians.find((g) => g.isPrimaryContact) ??
      guardians[0];
    setSelectedGuardianId(preferred.guardianId);
  }, [open, guardians, selectedGuardianId]);

  useEffect(() => {
    if (open) return;
    setSelectedGuardianId(undefined);
    setEmailDraft('');
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setIncludeCharges(false);
    setError(null);
  }, [open]);

  const selected = guardians.find((g) => g.guardianId === selectedGuardianId);
  const needsEmail = Boolean(selected) && !selected!.guardianEmail;
  const selectedFull = useGuardian(needsEmail ? selectedGuardianId : undefined);
  const updateGuardian = useUpdateGuardian(selectedGuardianId ?? '');

  const canSendExisting = Boolean(
    selected &&
      (selected.guardianEmail || (emailDraft.trim().length > 0 && Boolean(selectedFull.data))),
  );
  const canSendNew =
    !hasGuardians &&
    Boolean(newFirstName.trim() && newLastName.trim() && newPhone.trim()) &&
    /^(?:[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(newEmail.trim());

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
        await sendEmail.mutateAsync({ guardianId: guardian.id, includeCharges });
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
      await sendEmail.mutateAsync({ guardianId: selected.guardianId, includeCharges });
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
          <DialogTitle>Email receipt</DialogTitle>
          <DialogDescription>
            Send this payment receipt to a guardian. You can include the invoice charges if you want the attachment to show each charge on the receipt.
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
                        type="radio"
                        name="email-receipt-guardian"
                        className="mt-0.5 size-4 shrink-0 border-input"
                        checked={selectedGuardianId === link.guardianId}
                        onChange={() => { setSelectedGuardianId(link.guardianId); setEmailDraft(''); }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{link.guardianName}</span>
                          <span className="text-xs text-muted-foreground">{humanizeEnum(link.relationship)}</span>
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
                  <Label htmlFor="email-receipt-new-email" required>
                    Email address for {selected!.guardianName}
                  </Label>
                  <Input
                    id="email-receipt-new-email"
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
                This student has no guardian on file yet. Add one first so the receipt can be emailed.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="First name" value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} />
                <Input placeholder="Last name" value={newLastName} onChange={(event) => setNewLastName(event.target.value)} />
                <Input placeholder="Phone" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
                <Input placeholder="Email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeCharges}
              onChange={(event) => setIncludeCharges(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Include invoice charges on the receipt PDF
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              (hasGuardians && !canSendExisting) ||
              (!hasGuardians && !canSendNew) ||
              sendEmail.isPending ||
              createGuardian.isPending ||
              linkGuardian.isPending ||
              updateGuardian.isPending
            }
            onClick={() => void send()}
          >
            {sendEmail.isPending ? 'Sending…' : 'Send receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
