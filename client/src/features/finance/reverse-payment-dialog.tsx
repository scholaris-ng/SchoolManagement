import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';
import { useReversePayment } from './use-payments';
import type { Payment } from '@/types/finance';
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
 * Whether the reverse action applies to a payment — the same three rules
 * `reversalRefusal` enforces on the server, so the button is only offered where
 * it can succeed. The server is still the authority; this only saves a
 * round trip to a refusal.
 */
export function isReversible(payment: Payment): boolean {
  return payment.status === 'SUCCESSFUL' && payment.provider === 'MANUAL' && !payment.isReconciled;
}

interface ReversePaymentDialogProps {
  payment: Payment | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Undoing a payment that was recorded wrongly.
 *
 * There is no "edit amount": a receipt the family may already hold would then
 * disagree with the ledger. The correction is to reverse the payment, with a
 * reason on the record, and record the right one — which is why the second
 * button carries the bursar straight into the payment form for the same student.
 */
export function ReversePaymentDialog({ payment, onOpenChange }: ReversePaymentDialogProps) {
  const navigate = useNavigate();
  const reverse = useReversePayment();
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    reverse.reset();
    onOpenChange(false);
  };

  const submit = async (recordAgain: boolean) => {
    if (!payment) return;
    try {
      await reverse.mutateAsync({ id: payment.id, reason: reason.trim() });
    } catch {
      // Stays open: the refusal is shown below, from the mutation's own state.
      return;
    }
    const { studentId } = payment;
    close();
    if (recordAgain && studentId) navigate(`/finance/payments/new?studentId=${studentId}`);
  };

  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH;
  const invoices = payment?.allocations.map((allocation) => allocation.invoiceNo) ?? [];

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent size="md" data-cy="finance-reverse-payment-dialog">
        <DialogHeader>
          <DialogTitle>Reverse this payment?</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                {formatCurrency(payment.amount, 'NGN')} from {payment.studentName} (
                {humanizeEnum(payment.method)}, {payment.receiptNo ?? payment.reference}).
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              The money comes off {payment?.studentName ?? 'the student'}&apos;s account
              {invoices.length > 0 && (
                <>
                  , and {invoices.length === 1 ? 'invoice' : 'invoices'}{' '}
                  <span className="font-medium text-foreground">{invoices.join(', ')}</span>{' '}
                  {invoices.length === 1 ? 'is' : 'are'} owed again
                </>
              )}
              .
            </li>
            <li>
              The receipt stays on file, marked reversed. It can no longer be printed or sent.
            </li>
            <li>To correct a wrong amount, record the right payment afterwards.</li>
          </ul>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="reverse-payment-reason">
              Reason
            </label>
            <Textarea
              data-cy="finance-reverse-payment-reason"
              id="reverse-payment-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Typed 50,000 instead of 5,000"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Kept on the payment and in the audit log.
            </p>
          </div>

          {reverse.error !== null && reverse.error !== undefined && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(reverse.error, 'Could not reverse this payment. Please try again.')}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            data-cy="finance-reverse-payment-cancel"
            variant="outline"
            onClick={close}
            disabled={reverse.isPending}
          >
            Cancel
          </Button>
          <Button
            data-cy="finance-reverse-payment-confirm"
            variant="danger"
            onClick={() => void submit(false)}
            loading={reverse.isPending}
            disabled={!canConfirm}
          >
            Reverse payment
          </Button>
          <Button
            data-cy="finance-reverse-payment-and-record"
            onClick={() => void submit(true)}
            disabled={!canConfirm || reverse.isPending}
          >
            Reverse &amp; record again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
