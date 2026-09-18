import { useSendInvoiceEmail } from './api';
import { EmailDocumentDialog } from './email-document-dialog';

/** Emails one invoice, with a PDF copy attached, to a guardian of its student. */
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
  const sendEmail = useSendInvoiceEmail(invoiceId);

  return (
    <EmailDocumentDialog
      open={open}
      onOpenChange={onOpenChange}
      studentId={studentId}
      title="Email invoice"
      description="Sends this invoice to a guardian by email, with a PDF copy attached. This never creates them a parent-portal account — that stays a separate, deliberate step from their own profile."
      cyPrefix="email-invoice"
      onSend={(guardianId) => sendEmail.mutateAsync(guardianId)}
    />
  );
}
