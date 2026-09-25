import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { errorMessage } from '@/lib/api-error';
import { useCancelInvoice } from './api';
import type { Invoice } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MIN_REASON_LENGTH = 3;

/**
 * Whether cancelling applies to an invoice — the same rules
 * `InvoicesService.cancelInvoice` enforces, so the button is only offered where
 * it can succeed. The server is still the authority; this only saves a trip to
 * a refusal.
 */
export function isCancellable(invoice: Pick<Invoice, 'status' | 'amountPaid'>): boolean {
  return invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && invoice.amountPaid <= 0;
}

interface CancelInvoiceDialogProps {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Withdrawing an invoice that should not have been raised, or that is being
 * replaced. The invoice stays on file, marked cancelled, with the reason on it —
 * the family that was sent the bill is owed an explanation of why it went away.
 *
 * Anything this invoice took over from earlier ones (a balance carried in) is
 * given back: those invoices reopen and stand on their own again.
 */
export function CancelInvoiceDialog({ invoice, onOpenChange }: CancelInvoiceDialogProps) {
  const cancel = useCancelInvoice();
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    cancel.reset();
    onOpenChange(false);
  };

  const submit = async () => {
    if (!invoice) return;
    try {
      await cancel.mutateAsync({ id: invoice.id, reason: reason.trim() });
    } catch {
      // Stays open: the refusal is shown below, from the mutation's own state.
      return;
    }
    close();
  };

  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH;
  const reopened = invoice?.carriedFrom.map((source) => source.invoiceNo) ?? [];

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent size="md" data-cy="finance-cancel-invoice-dialog">
        <DialogHeader>
          <DialogTitle>Cancel this invoice?</DialogTitle>
          <DialogDescription>
            {invoice && (
              <>
                {invoice.invoiceNo} for {invoice.studentName} —{' '}
                {formatCurrency(invoice.total, 'NGN', { showDecimals: false })}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {reopened.length > 0 && (
              <li>
                <span className="font-medium text-foreground">{reopened.join(', ')}</span>{' '}
                {reopened.length === 1 ? 'reopens' : 'reopen'} and{' '}
                {reopened.length === 1 ? 'is' : 'are'} owed again on{' '}
                {reopened.length === 1 ? 'its' : 'their'} own, as before this invoice took{' '}
                {reopened.length === 1 ? 'it' : 'them'} over.
              </li>
            )}
            <li>This invoice stays on file, marked cancelled, with your reason on it.</li>
            <li>It cannot be reopened. To bill again, create a new invoice.</li>
          </ul>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="cancel-invoice-reason">
              Reason
            </label>
            <Textarea
              data-cy="finance-cancel-invoice-reason"
              id="cancel-invoice-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Raised before the fee items were itemized — replacing it"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">Kept on the invoice and in the audit log.</p>
          </div>

          {cancel.error !== null && cancel.error !== undefined && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(cancel.error, 'Could not cancel this invoice. Please try again.')}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            data-cy="finance-cancel-invoice-keep"
            variant="outline"
            onClick={close}
            disabled={cancel.isPending}
          >
            Keep invoice
          </Button>
          <Button
            data-cy="finance-cancel-invoice-confirm"
            variant="danger"
            onClick={() => void submit()}
            loading={cancel.isPending}
            disabled={!canConfirm}
          >
            Cancel invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
