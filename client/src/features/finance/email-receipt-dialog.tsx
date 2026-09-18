import { useEffect, useState } from 'react';
import { useSendReceiptEmail } from './api';
import { EmailDocumentDialog } from './email-document-dialog';

/** Emails one payment receipt, as a PDF, to a guardian of the student it was for. */
export function EmailReceiptDialog({
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
  const sendEmail = useSendReceiptEmail(paymentId);
  const [includeCharges, setIncludeCharges] = useState(false);

  useEffect(() => {
    if (!open) setIncludeCharges(false);
  }, [open]);

  return (
    <EmailDocumentDialog
      open={open}
      onOpenChange={onOpenChange}
      studentId={studentId}
      title="Email receipt"
      description="Sends this payment receipt to a guardian by email as a PDF. This never creates them a parent-portal account — that stays a separate, deliberate step from their own profile."
      cyPrefix="email-receipt"
      onSend={(guardianId) => sendEmail.mutateAsync({ guardianId, includeCharges })}
    >
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          data-cy="email-receipt-include-charges"
          type="checkbox"
          checked={includeCharges}
          onChange={(event) => setIncludeCharges(event.target.checked)}
          className="size-4 rounded border-input"
        />
        Include invoice charges on the receipt PDF
      </label>
    </EmailDocumentDialog>
  );
}
