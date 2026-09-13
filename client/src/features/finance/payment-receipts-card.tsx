import { useRef, useState } from 'react';
import { FileText, Paperclip, Upload } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';
import { FILE_PRESETS, FileValidationError, validateFile } from '@/lib/file-storage';
import { useInvoices } from './api';
import { useStudentPaymentReceipts, useSubmitPaymentReceipt } from './use-payment-receipts';
import type { PaymentMethod, PaymentReceiptSubmission } from '@/types/finance';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/data/status-badge';
import { Sheet } from '@/components/ui/dialog';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash deposit' },
  { value: 'POS', label: 'POS terminal' },
  { value: 'CHEQUE', label: 'Cheque' },
];

/**
 * Evidence of a payment made outside the portal — a bank transfer, a cash
 * deposit, an agent's POS — submitted for the office to check against the
 * bank statement. Nothing here is money until a member of staff approves it;
 * see `PaymentReceiptsService` on the server.
 */
export function PaymentReceiptsCard({
  studentId,
  currency = 'NGN',
}: {
  studentId: string;
  currency?: string;
}) {
  const receipts = useStudentPaymentReceipts(studentId);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Payment receipts</CardTitle>
          <CardDescription>
            Paid by bank transfer or at an agent, outside the portal? Upload the slip and the
            office will check it against the bank statement.
          </CardDescription>
        </div>
        <Button data-cy="payment-receipt-submit-open" onClick={() => setOpen(true)}>
          <Upload />
          Submit a receipt
        </Button>
      </CardHeader>
      <CardContent>
        {receipts.isPending ? (
          <LoadingState label="Loading your submissions…" />
        ) : (receipts.data ?? []).length === 0 ? (
          <EmptyState
            compact
            icon={<Paperclip />}
            title="Nothing submitted yet"
            description="If you have already paid outside the portal, submit the slip above."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(receipts.data ?? []).map((receipt) => (
              <ReceiptRow key={receipt.id} receipt={receipt} currency={currency} />
            ))}
          </ul>
        )}
      </CardContent>

      <SubmitReceiptSheet
        studentId={studentId}
        open={open}
        onOpenChange={setOpen}
      />
    </Card>
  );
}

function ReceiptRow({ receipt, currency }: { receipt: PaymentReceiptSubmission; currency: string }) {
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={receipt.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <FileText className="size-4" />
            View slip
          </a>
          <StatusBadge status={receipt.status} />
        </div>
        <p className="mt-0.5 truncate text-muted-foreground">
          {humanizeEnum(receipt.method)} · {formatDate(receipt.paidAt)}
          {receipt.invoiceNo ? ` · ${receipt.invoiceNo}` : ''}
        </p>
        {receipt.status === 'REJECTED' && receipt.reviewNote && (
          <p className="mt-1 text-xs text-danger">Declined: {receipt.reviewNote}</p>
        )}
        {receipt.status === 'PENDING' && (
          <p className="mt-1 text-xs text-muted-foreground">Waiting for the office to check this.</p>
        )}
      </div>
      <p className="font-medium tabular-nums">{formatCurrency(receipt.amount, currency)}</p>
    </li>
  );
}

function SubmitReceiptSheet({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useSubmitPaymentReceipt();
  const invoices = useInvoices(
    { page: 1, pageSize: 50, studentId, status: 'UNPAID' },
    { enabled: open },
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paidAt, setPaidAt] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const reset = () => {
    setInvoiceId('');
    setAmount('');
    setMethod('BANK_TRANSFER');
    setPaidAt('');
    setReference('');
    setNote('');
    setFile(null);
    setFileError(null);
    submit.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const chooseFile = (chosen: File | undefined) => {
    if (!chosen) return;
    try {
      validateFile(chosen, 'document');
      setFile(chosen);
      setFileError(null);
    } catch (cause) {
      setFile(null);
      setFileError(cause instanceof FileValidationError ? cause.message : 'That file could not be used.');
    }
  };

  const valid = Boolean(file) && Number(amount) > 0 && Boolean(paidAt);

  const handleSubmit = async () => {
    if (!valid || !file) return;
    await submit.mutateAsync({
      studentId,
      invoiceId: invoiceId || undefined,
      amount: Number(amount),
      method,
      paidAt: new Date(paidAt).toISOString(),
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      file,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Submit a payment receipt"
      description="Upload a photo or PDF of the slip. The office checks it against the bank statement before it is recorded."
      data-cy="payment-receipt-submit-sheet"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button
            data-cy="payment-receipt-submit"
            onClick={() => void handleSubmit()}
            loading={submit.isPending}
            disabled={!valid}
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submit.isError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(submit.error, 'Could not submit this receipt. Please try again.')}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="receipt-invoice">What it is for</Label>
          <NativeSelect
            id="receipt-invoice"
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
          >
            <option value="">General payment (not tied to one invoice)</option>
            {(invoices.data?.items ?? []).map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNo} · {formatCurrency(invoice.balance, 'NGN', { showDecimals: false })}{' '}
                outstanding
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-amount" required>
              Amount paid
            </Label>
            <Input
              id="receipt-amount"
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 185000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-method" required>
              How you paid
            </Label>
            <NativeSelect
              id="receipt-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-date" required>
              Date paid
            </Label>
            <Input
              id="receipt-date"
              type="date"
              value={paidAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-reference">Teller or transfer reference</Label>
            <Input
              id="receipt-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receipt-note">Note</Label>
          <Textarea
            id="receipt-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything the office should know"
          />
        </div>

        <div className="space-y-1.5">
          <Label required>Photo or PDF of the slip</Label>
          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload />
              Choose file
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{FILE_PRESETS.document.label}</p>
          {fileError && (
            <p role="alert" className="text-xs text-danger">
              {fileError}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_PRESETS.document.accept}
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>
      </div>
    </Sheet>
  );
}
