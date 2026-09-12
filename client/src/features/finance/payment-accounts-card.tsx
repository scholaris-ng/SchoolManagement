import { useState } from 'react';
import { Copy, Check, Landmark } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/api-error';
import { useCreatePaymentAccount, useStudentPaymentAccounts } from './use-payments';
import type { PaymentAccount } from '@/types/finance';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState, Tooltip } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

/**
 * Paying school fees by bank transfer, without the office typing anything in.
 *
 * The office asks Raven for an account number for one bill — this student,
 * this amount — and gives it to the family, who transfer from whichever
 * banking app they already use. When the money lands, Raven tells the server
 * and the payment appears against the student on its own. The number is the
 * whole hand-off, which is why it can be copied in one click.
 */
export function PaymentAccountsCard({
  studentId,
  currency = 'NGN',
  invoiceId,
  defaultAmount,
}: {
  studentId: string;
  currency?: string;
  /**
   * Ties the account to one bill. Whatever lands on it settles that invoice
   * automatically, instead of arriving as money on account for the office to
   * match up the next morning.
   */
  invoiceId?: string;
  /** Pre-fills the amount — the invoice's outstanding balance, on its page. */
  defaultAmount?: number;
}) {
  const accounts = useStudentPaymentAccounts(studentId);
  const create = useCreatePaymentAccount();
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  const [bvn, setBvn] = useState('');
  const [note, setNote] = useState('');

  const bvnValid = /^\d{11}$/.test(bvn);

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0 || !bvnValid) return;
    await create.mutateAsync({
      studentId,
      amount: value,
      bvn,
      note: note.trim() || undefined,
      invoiceId,
    });
    setAmount('');
    setBvn('');
    setNote('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay by bank transfer</CardTitle>
        <CardDescription>
          A dedicated account number, from Raven, issued in the guardian&apos;s name for them to
          transfer this student&apos;s fees into. Whatever lands on it is recorded here
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PermissionGate require="payment.manage">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_11rem_1fr_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="payment-account-amount" required>
                Amount
              </Label>
              <Input
                data-cy="payment-account-amount"
                id="payment-account-amount"
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
              <Label htmlFor="payment-account-bvn" required>
                Guardian&apos;s BVN
              </Label>
              <Input
                data-cy="payment-account-bvn"
                id="payment-account-bvn"
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                value={bvn}
                onChange={(event) => setBvn(event.target.value.replace(/\D/g, ''))}
                placeholder="11 digits"
                invalid={bvn.length > 0 && !bvnValid}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-account-note">What it is for</Label>
              <Input
                data-cy="payment-account-note"
                id="payment-account-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional — e.g. Second term fees"
                maxLength={200}
              />
            </div>
            <Button
              data-cy="payment-account-generate"
              type="submit"
              loading={create.isPending}
              disabled={!Number(amount) || Number(amount) <= 0 || !bvnValid}
            >
              <Landmark />
              Generate account number
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Banking rules require the payer&apos;s BVN to open an account in their name. It is sent to
            Raven for verification only — Scholaris does not store it.
          </p>
          {create.isError && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(create.error, 'Raven could not issue an account number. Please try again.')}
            </p>
          )}
        </PermissionGate>

        {accounts.isPending ? (
          <LoadingState label="Loading payment accounts…" />
        ) : (accounts.data ?? []).length === 0 ? (
          <EmptyState
            compact
            icon={<Landmark />}
            title="No account numbers issued yet"
            description="Generate one above to give the family somewhere to pay."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(accounts.data ?? []).map((account) => (
              <AccountRow key={account.id} account={account} currency={currency} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AccountRow({ account, currency }: { account: PaymentAccount; currency: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the number is still on screen to read.
    }
  };

  const outstanding = Math.max(account.amount - account.amountPaid, 0);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-semibold tabular-nums">{account.accountNumber}</span>
          <Tooltip content={copied ? 'Copied' : 'Copy account number'}>
            <Button variant="ghost" size="icon-sm" type="button" onClick={() => void copy()} aria-label="Copy account number">
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </Tooltip>
          <StatusPill status={account.status} />
        </div>
        <p className="mt-0.5 truncate text-muted-foreground">
          {account.bankName} · {account.accountName}
        </p>
        {account.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.note}</p>}
      </div>
      <div className="text-right">
        <p className="font-medium tabular-nums">{formatCurrency(account.amount, currency)}</p>
        <p className="text-xs text-muted-foreground">
          {account.amountPaid > 0
            ? `${formatCurrency(account.amountPaid, currency)} received${outstanding > 0 ? ` · ${formatCurrency(outstanding, currency)} to go` : ''}`
            : `Issued ${formatDate(account.createdAt)}`}
        </p>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: PaymentAccount['status'] }) {
  if (status === 'PAID') return <Badge tone="success">Paid</Badge>;
  if (status === 'CLOSED') return <Badge tone="neutral">Closed</Badge>;
  return <Badge tone="info">Awaiting payment</Badge>;
}
