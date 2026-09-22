import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStudent, useStudentLedger, useStudentSearch } from '@/features/students/api';
import { useInvoice, useInvoices, useRecordPayment } from './api';
import type { PaymentMethod } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { FormError } from '@/components/forms/form-actions';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'POS', label: 'POS terminal' },
  { value: 'CHEQUE', label: 'Cheque' },
];

/**
 * Recording money that arrived offline.
 *
 * Online card payments never pass through this screen: those are confirmed by a
 * verified provider webhook on the server, because a browser coming back from a
 * payment page proves nothing about whether the money moved (spec section 27).
 */
export function PaymentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordPayment = useRecordPayment();

  const preselectedStudentId = searchParams.get('studentId') ?? '';
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState(preselectedStudentId);
  const [studentLabel, setStudentLabel] = useState('');
  const results = useStudentSearch(studentQuery, { enabled: studentQuery.length >= 2 });

  // Fills in the name and admission number for whichever student is
  // currently selected — a `?studentId=` handed in from the student's own
  // Fees tab, or one just picked from the search below — so the card never
  // sits blank waiting on this fetch to resolve.
  const studentDetails = useStudent(studentId || undefined);
  useEffect(() => {
    if (studentDetails.data && studentDetails.data.id === studentId) {
      setStudentLabel(`${studentDetails.data.fullName} · ${studentDetails.data.admissionNo}`);
    }
  }, [studentDetails.data, studentId]);

  const ledger = useStudentLedger(studentId || undefined);
  const openInvoices = useInvoices({
    page: 1,
    pageSize: 50,
    studentId: studentId || undefined,
    status: 'UNPAID',
  });

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  // Which invoice's charges are broken out for itemizing — one at a time,
  // since naming which fee item a payment was for is the exception, not the
  // rule. `lineAllocations[invoiceId]` survives collapsing that invoice back
  // up, so expanding it again does not lose what was typed.
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [lineAllocations, setLineAllocations] = useState<Record<string, Record<string, string>>>({});
  const expandedInvoice = useInvoice(expandedInvoiceId ?? undefined);

  const invoices = useMemo(
    () => (openInvoices.data?.items ?? []).filter((invoice) => invoice.balance > 0),
    [openInvoices.data],
  );

  // Default to settling the oldest invoices first, which is what a bursar does
  // by hand — but leave every figure editable.
  useEffect(() => {
    const total = Number(amount);
    if (!Number.isFinite(total) || total <= 0 || invoices.length === 0) return;
    let remaining = total;
    const next: Record<string, string> = {};
    [...invoices]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach((invoice) => {
        const applied = Math.min(invoice.balance, remaining);
        if (applied > 0) next[invoice.id] = String(applied);
        remaining -= applied;
      });
    setAllocations(next);
  }, [amount, invoices]);

  const allocatedTotal = Object.values(allocations).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  const unallocated = Math.max(0, (Number(amount) || 0) - allocatedTotal);
  const overAllocated = allocatedTotal > (Number(amount) || 0);

  const lineSumFor = (invoiceId: string) =>
    Object.values(lineAllocations[invoiceId] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const setLineAmount = (invoiceId: string, lineId: string, value: string) =>
    setLineAllocations((current) => ({
      ...current,
      [invoiceId]: { ...(current[invoiceId] ?? {}), [lineId]: value },
    }));

  // A line breakdown only has to add up once it has been started — typing
  // nothing into any of an invoice's charges leaves it a plain lump sum, same
  // as before this existed. The moment one is filled in, though, the whole
  // amount applied to that invoice must be accounted for by name, the same
  // invariant the server enforces — caught here so the mismatch is obvious
  // before submitting rather than after.
  const mismatchedInvoiceIds = new Set(
    Object.keys(lineAllocations).filter((invoiceId) => {
      const lineSum = lineSumFor(invoiceId);
      if (lineSum <= 0) return false;
      return Math.abs(lineSum - (Number(allocations[invoiceId]) || 0)) > 0.004;
    }),
  );

  const valid =
    Boolean(studentId) &&
    Number(amount) > 0 &&
    Boolean(paidAt) &&
    !overAllocated &&
    mismatchedInvoiceIds.size === 0;

  const submit = async () => {
    if (!valid) return;
    const payment = await recordPayment.mutateAsync({
      studentId,
      amount: Number(amount),
      method,
      paidAt: new Date(paidAt).toISOString(),
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      allocations: Object.entries(allocations)
        .filter(([, value]) => Number(value) > 0)
        .map(([invoiceId, value]) => {
          const lines = Object.entries(lineAllocations[invoiceId] ?? {})
            .filter(([, lineValue]) => Number(lineValue) > 0)
            .map(([lineId, lineValue]) => ({ lineId, amount: Number(lineValue) }));
          return {
            invoiceId,
            amount: Number(value),
            ...(lines.length > 0 ? { lines } : {}),
          };
        }),
    });
    navigate(`/finance/receipts/${payment.id}`);
  };

  const balance = ledger.data?.summary.balance ?? 0;
  // The commonest keying slip is an extra or a missing zero, and the tell is a
  // figure larger than the student could possibly owe. A student who owes
  // nothing is left alone: paying ahead is legitimate.
  const exceedsBalance = Boolean(ledger.data) && balance > 0 && Number(amount) > balance;

  // Reached from a student's own Fees tab, this should hand the bursar back
  // to that student rather than dropping them on the general payments list
  // they never asked to see.
  const backTo = preselectedStudentId
    ? `/students/${preselectedStudentId}?tab=finance`
    : '/finance/payments';
  const breadcrumbs = preselectedStudentId
    ? [
        { label: 'Students', to: '/students' },
        { label: studentLabel || 'Student', to: backTo },
        { label: 'Record payment' },
      ]
    : [
        { label: 'Finance', to: '/finance' },
        { label: 'Payments', to: '/finance/payments' },
        { label: 'Record' },
      ];

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Record a payment"
        description="For cash, transfer, POS and cheque payments taken at the school."
        breadcrumbs={breadcrumbs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Who paid?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={recordPayment.error} />

          {studentId && studentLabel ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{studentLabel}</p>
                {ledger.data && (
                  <p className="truncate text-xs text-muted-foreground">
                    Outstanding balance{' '}
                    <span className={balance > 0 ? 'font-medium text-danger' : 'text-success'}>
                      {formatCurrency(balance, 'NGN')}
                    </span>
                  </p>
                )}
              </div>
              <Button
                data-cy="finance-payment-form-change"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStudentId('');
                  setStudentLabel('');
                  setAllocations({});
                  setLineAllocations({});
                  setExpandedInvoiceId(null);
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="payment-student" required>
                Student
              </Label>
              <SearchInput
                data-cy="finance-payment-form-student-query"
                value={studentQuery}
                onValueChange={setStudentQuery}
                placeholder="Search by name or admission number…"
                isSearching={results.isSearching}
              />
              {results.data && results.data.length > 0 && (
                <ul className="max-h-56 overflow-y-auto rounded-md border border-border">
                  {results.data.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        data-cy={`payment-student-result-${match.id}`}
                        onClick={() => {
                          setStudentId(match.id);
                          setStudentLabel(`${match.fullName} · ${match.admissionNo}`);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0 flex-1 truncate">{match.fullName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {match.admissionNo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" required>
                Amount
              </Label>
              <Input
                data-cy="payment-amount"
                id="payment-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
              {/* 500000 and 50,000 are easy to confuse in a bare number field. */}
              {Number(amount) > 0 && (
                <p data-cy="payment-amount-preview" className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(Number(amount), 'NGN')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" required>
                Method
              </Label>
              <NativeSelect
                data-cy="payment-method"
                id="payment-method"
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
              <Label htmlFor="payment-date" required>
                Date received
              </Label>
              <Input
                data-cy="payment-date"
                id="payment-date"
                type="date"
                value={paidAt}
                max={toDateInputValue(new Date())}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-reference">Bank or teller reference</Label>
              <Input
                data-cy="payment-reference"
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {exceedsBalance && (
            <Alert tone="warning" title="That is more than this student owes">
              {formatCurrency(Number(amount), 'NGN')} is above their outstanding{' '}
              {formatCurrency(balance, 'NGN')}. Check the amount for a mistyped digit before
              recording.
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note</Label>
            <Textarea
              data-cy="payment-note"
              id="payment-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {studentId && (
        <Card>
          <CardHeader>
            <CardTitle>Apply to invoices</CardTitle>
            <CardDescription>
              Defaulted to the oldest invoices first. Anything left over is held on the family
              account and applied to the next invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 ? (
              <Alert tone="info">
                This student has no outstanding invoices. The payment will be held on account.
              </Alert>
            ) : (
              <ul className="space-y-2">
                {invoices.map((invoice) => {
                  const expanded = expandedInvoiceId === invoice.id;
                  const mismatched = mismatchedInvoiceIds.has(invoice.id);
                  return (
                    <li key={invoice.id} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{invoice.invoiceNo}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {invoice.termName} · due {formatDate(invoice.dueDate)} · balance{' '}
                            {formatCurrency(invoice.balance, 'NGN', { showDecimals: false })}
                          </p>
                        </div>
                        <div className="w-32 space-y-1.5">
                          <Label htmlFor={`alloc-${invoice.id}`} className="text-xs">
                            Apply
                          </Label>
                          <Input
                            data-cy="finance-payment-form-id"
                            id={`alloc-${invoice.id}`}
                            type="number"
                            min={0}
                            max={invoice.balance}
                            value={allocations[invoice.id] ?? ''}
                            onChange={(event) =>
                              setAllocations((current) => ({
                                ...current,
                                [invoice.id]: event.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        data-cy={`finance-payment-form-toggle-lines-${invoice.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedInvoiceId(expanded ? null : invoice.id)}
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-3.5" aria-hidden="true" />
                        )}
                        Name which fee item this pays for
                      </button>

                      {expanded && (
                        <div className="space-y-2 rounded-md bg-muted/40 p-3">
                          {expandedInvoice.isPending ? (
                            <p className="text-xs text-muted-foreground">Loading charges…</p>
                          ) : (
                            <>
                              {(() => {
                                const openLines = (expandedInvoice.data?.lines ?? []).filter(
                                  (line) => line.balance > 0,
                                );
                                const linesBalance = openLines.reduce((sum, line) => sum + line.balance, 0);
                                // Only worth offering when it lines up with what is being
                                // applied to the invoice — otherwise "in full" on every
                                // charge would just trip the mismatch warning below.
                                const canFillAll =
                                  openLines.length > 1 &&
                                  Math.abs(linesBalance - (Number(allocations[invoice.id]) || 0)) < 0.005;
                                return (
                                  canFillAll && (
                                    <button
                                      type="button"
                                      data-cy={`finance-payment-form-fill-all-${invoice.id}`}
                                      className="text-xs text-primary hover:underline"
                                      onClick={() =>
                                        setLineAllocations((current) => ({
                                          ...current,
                                          [invoice.id]: Object.fromEntries(
                                            openLines.map((line) => [line.id, String(line.balance)]),
                                          ),
                                        }))
                                      }
                                    >
                                      Every charge is being paid in full — fill them all
                                    </button>
                                  )
                                );
                              })()}
                              <ul className="space-y-2">
                                {(expandedInvoice.data?.lines ?? [])
                                  .filter((line) => line.balance > 0)
                                  .map((line) => (
                                    <li key={line.id} className="flex items-center gap-3">
                                      <div className="min-w-0 flex-1 text-xs">
                                        <p className="truncate">{line.description}</p>
                                        <p className="text-muted-foreground">
                                          balance {formatCurrency(line.balance, 'NGN', { showDecimals: false })}
                                          {' · '}
                                          <button
                                            type="button"
                                            data-cy={`finance-payment-form-line-full-${line.id}`}
                                            className="text-primary hover:underline"
                                            onClick={() => setLineAmount(invoice.id, line.id, String(line.balance))}
                                          >
                                            Pay in full
                                          </button>
                                        </p>
                                      </div>
                                      <Input
                                        data-cy={`finance-payment-form-line-${line.id}`}
                                        type="number"
                                        min={0}
                                        max={line.balance}
                                        value={lineAllocations[invoice.id]?.[line.id] ?? ''}
                                        onChange={(event) => setLineAmount(invoice.id, line.id, event.target.value)}
                                        className="h-8 w-28"
                                      />
                                    </li>
                                  ))}
                              </ul>
                              <p className={cn('text-xs', mismatched ? 'font-medium text-danger' : 'text-muted-foreground')}>
                                {formatCurrency(lineSumFor(invoice.id), 'NGN', { showDecimals: false })} of{' '}
                                {formatCurrency(Number(allocations[invoice.id]) || 0, 'NGN', {
                                  showDecimals: false,
                                })}{' '}
                                applied named by fee item
                                {mismatched && ' — these must add up to the amount applied above'}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Applied to invoices</dt>
                <dd className="tabular-nums">
                  {formatCurrency(allocatedTotal, 'NGN', { showDecimals: false })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Held on account</dt>
                <dd className="tabular-nums">
                  {formatCurrency(unallocated, 'NGN', { showDecimals: false })}
                </dd>
              </div>
            </dl>

            {overAllocated && (
              <Alert tone="danger" title="More has been applied than was paid">
                Reduce the amounts applied so they add up to no more than the payment.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button data-cy="finance-payment-form-cancel" variant="outline" onClick={() => navigate(backTo)}>
          Cancel
        </Button>
        <Button data-cy="finance-payment-form-record-payment" onClick={() => void submit()} loading={recordPayment.isPending} disabled={!valid}>
          Record payment
        </Button>
      </div>
    </PageContainer>
  );
}
