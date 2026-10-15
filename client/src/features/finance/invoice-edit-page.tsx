import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { toast } from '@/lib/toast-bus';
import {
  useDiscounts,
  useFeeItems,
  useInvoice,
  useResolveFeeStructure,
  useStudentDiscounts,
  useUpdateInvoice,
} from './api';
import { grantReachesTerm, resolveDiscountScope } from './discount-scope';
import { previewDiscounts } from './discount-math';
import { InvoiceDiscountsPicker, type ChosenDiscount } from './invoice-discounts-picker';
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
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { FormError } from '@/components/forms/form-actions';
import { Row } from './invoice-form-page-parts';

interface LineDraft {
  feeItemId: string;
  /** Only ever editable, or worth more than 1, for a fee item marked `hasQuantity`. */
  quantity: number;
  /** Which of the fee item's own accounts this charge is billed under. */
  accountIds: string[];
  /** The line's own snapshot at billing time — shown only if the fee item has since been deleted, so it can still be identified and removed. */
  description: string;
  /** One of the fee item's own named prices; unset bills the item's own `amount`. */
  priceOptionId?: string;
  /** A discount keyed straight onto this charge, no named reason attached. */
  discountMode: 'FIXED' | 'PERCENTAGE';
  /** As typed — a currency amount under `FIXED`, 0-100 under `PERCENTAGE`. Blank means no discount. */
  discountValue: string;
}

/**
 * What the charges and discounts on the form add up to, as one comparable
 * string — so "did the person change the charges?" is a string comparison
 * rather than a hand-written field-by-field diff that drifts out of date.
 */
function draftKey(lines: LineDraft[], discounts: ChosenDiscount[]): string {
  return JSON.stringify({
    lines: lines.map((line) => [
      line.feeItemId,
      line.quantity,
      line.priceOptionId ?? null,
      line.discountMode,
      line.discountValue,
      [...line.accountIds].sort(),
    ]),
    discounts: discounts
      .map((entry) => [entry.discountId, [...entry.feeItemIds].sort()])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
}

/**
 * Editing an issued invoice.
 *
 * The student and term are fixed — those are what the bill is *for*, not
 * what it says, so a mistake there means deleting this invoice and raising a
 * fresh one rather than editing this one into a different family's bill.
 *
 * Everything else can be corrected, and every correction is kept as a version
 * (see `InvoiceHistoryCard`), so a mistake no longer has to be fixed by
 * cancelling the bill and raising another. Once money has landed the same holds
 * with two limits, both enforced by the server: the total cannot fall below
 * what has been paid, and a charge a payment was itemised to cannot be removed
 * or cut below what it took.
 */
export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoice = useInvoice(id);
  const studentDiscounts = useStudentDiscounts(invoice.data?.studentId);
  const discounts = useDiscounts();
  const feeItems = useFeeItems();
  const updateInvoice = useUpdateInvoice();
  const resolveFeeStructure = useResolveFeeStructure();

  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  // Starts as the discounts the invoice already carries, so saving without
  // touching the picker keeps them; the server drops any that are no longer
  // active. The invoice's own record of an applied discount has no memory of
  // which lines it was scoped to, only what it waived in total, so a
  // previously-scoped discount reopens applying to every eligible line —
  // re-narrow it here if that bill only ever meant to cover one charge.
  const [chosenDiscounts, setChosenDiscounts] = useState<ChosenDiscount[]>([]);
  const [initialised, setInitialised] = useState(false);
  // Why the charges are changing — kept with the version this save creates.
  const [reason, setReason] = useState('');
  // The charges and discounts as they loaded, to tell a due-date or note edit
  // (which must not re-price a single line) from one that touched the charges.
  const [initialKey, setInitialKey] = useState('');

  // Waits on both the invoice and the fee item list: reconstructing which
  // accounts a line was billed under (see below) needs the item's current
  // accounts to match the line's snapshot against.
  useEffect(() => {
    if (!invoice.data || !feeItems.data || initialised) return;
    setDueDate(toDateInputValue(invoice.data.dueDate));
    setNote(invoice.data.note ?? '');
    const initialDiscounts = invoice.data.appliedDiscounts.map((entry) => ({
      discountId: entry.discountId,
      feeItemIds: [],
    }));
    setChosenDiscounts(initialDiscounts);
    const initialLines: LineDraft[] =
      // A carried charge is the balance this invoice took over, not one of its
      // own — sending it back as a line would bill it a second time.
      invoice.data.lines.filter((line) => !line.carriedFromInvoiceId).map((line) => {
        const item = feeItems.data.items.find((entry) => entry.id === line.feeItemId);
        // The line's snapshot has no id of its own to match by — only the
        // bank and account number, the same key the duplicate-accounts
        // screen uses to recognise "the same real account" elsewhere. If
        // none of the item's current accounts match at all (every one it
        // had has since been replaced), falling back to all of them beats
        // leaving the line with nowhere to pay into shown.
        const matched =
          item?.accounts
            .filter((account) =>
              line.accounts.some(
                (snapshot) =>
                  snapshot.bankName === account.bankName &&
                  snapshot.accountNumber === account.accountNumber,
              ),
            )
            .map((account) => account.id) ?? [];
        // The line snapshots only the amount it was actually billed at, not
        // which named price option (if any) produced it — inferred back by
        // matching that amount against the item's current options, since
        // they may have been renamed, reordered or repriced since.
        const matchedPriceOption = item?.priceOptions.find(
          (option) => option.amount === line.unitAmount,
        );
        return {
          feeItemId: line.feeItemId,
          quantity: line.quantity,
          accountIds: matched.length > 0 ? matched : (item?.accounts.map((a) => a.id) ?? []),
          description: line.description,
          priceOptionId: matchedPriceOption?.id,
          // The line only snapshots the combined total taken off it — manual
          // and named discounts together, with no record of how much of it
          // came from which. Reopening it as a manual amount would double it
          // up once the named discounts above are reapplied on top, so this
          // starts blank; re-key it here if this bill still needs it.
          discountMode: 'FIXED' as const,
          discountValue: '',
        };
      });
    setLines(initialLines);
    setInitialKey(draftKey(initialLines, initialDiscounts));
    setInitialised(true);
  }, [invoice.data, feeItems.data, initialised]);

  const items = useMemo(() => feeItems.data?.items ?? [], [feeItems.data]);
  // A fee item's own "(optional)" is its school-wide default; a resolved
  // structure can override that per item (boarding marked optional
  // everywhere except the one structure it is compulsory under). Filled in
  // once "Add all standard fees" has resolved a structure, so the dropdown
  // stops showing a default that this student's actual bill does not use.
  const [structureOptional, setStructureOptional] = useState<Map<string, boolean>>(new Map());
  const isOptionalFor = (feeItemId: string) =>
    structureOptional.get(feeItemId) ?? items.find((item) => item.id === feeItemId)?.isOptional ?? false;
  // Same idea, for price: a structure can charge a fee item at something
  // other than its school-wide default, and the server bills from that
  // override once a structure applies — see `InvoicesService.structureAmountsFor`.
  // Filled in alongside `structureOptional` so this screen's total agrees
  // with what gets charged instead of quietly pricing off the item's default.
  const [structureAmounts, setStructureAmounts] = useState<Map<string, number>>(new Map());
  // A line's own picked price option (see `FeeItem.priceOptions`) beats a
  // structure's price for the item, which beats the item's plain default —
  // the same priority `InvoicesService.resolveUnitAmount` bills from.
  const amountFor = useCallback(
    (feeItemId: string, priceOptionId?: string) => {
      const item = items.find((entry) => entry.id === feeItemId);
      const picked = priceOptionId
        ? item?.priceOptions.find((option) => option.id === priceOptionId)
        : undefined;
      return picked?.amount ?? structureAmounts.get(feeItemId) ?? item?.amount ?? 0;
    },
    [items, structureAmounts],
  );

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + amountFor(line.feeItemId, line.priceOptionId) * line.quantity,
        0,
      ),
    [lines, amountFor],
  );

  const grossFor = useCallback(
    (line: LineDraft) => amountFor(line.feeItemId, line.priceOptionId) * line.quantity,
    [amountFor],
  );

  // A discount keyed straight onto a charge, no named reason attached.
  // Never more than the charge itself, whether typed as a currency amount or
  // a percentage of it.
  const manualDiscountFor = useCallback(
    (line: LineDraft) => {
      const value = Number(line.discountValue);
      if (!value || value <= 0) return 0;
      const gross = grossFor(line);
      const raw = line.discountMode === 'PERCENTAGE' ? (gross * value) / 100 : value;
      return Math.min(gross, raw);
    },
    [grossFor],
  );

  const activeDiscounts = useMemo(
    () => (discounts.data ?? []).filter((discount) => discount.isActive),
    [discounts.data],
  );
  const grantedIds = useMemo(() => {
    const record = invoice.data;
    if (!record) return [];
    return (studentDiscounts.data ?? [])
      .filter(
        (grant) =>
          grantReachesTerm(grant, { id: record.termId, sessionId: record.sessionId }) &&
          activeDiscounts.some((discount) => discount.id === grant.discountId),
      )
      .map((grant) => grant.discountId);
  }, [invoice.data, studentDiscounts.data, activeDiscounts]);

  // The fee items actually on this bill, for the discount picker's own "Apply
  // to" choices.
  const lineFeeItems = useMemo(() => {
    const seen = new Set<string>();
    return lines
      .filter((line) => (seen.has(line.feeItemId) ? false : (seen.add(line.feeItemId), true)))
      .map((line) => ({
        id: line.feeItemId,
        name: items.find((item) => item.id === line.feeItemId)?.name ?? line.feeItemId,
      }));
  }, [lines, items]);

  // Granted discounts first, then the ones ticked for this bill — the order
  // the server takes them in. A preview only; the server prices the real bill.
  const discountPreview = useMemo(() => {
    const grantedEntries = grantedIds.flatMap((id) => activeDiscounts.find((d) => d.id === id) ?? []);
    const chosenEntries = chosenDiscounts.flatMap(({ discountId, feeItemIds }) => {
      const definition = activeDiscounts.find((d) => d.id === discountId);
      if (!definition) return [];
      return [{ ...definition, appliesToFeeItemIds: resolveDiscountScope(definition.appliesToFeeItemIds, feeItemIds) }];
    });
    return previewDiscounts(
      lines.map((line) => ({
        feeItemId: line.feeItemId,
        unitAmount: amountFor(line.feeItemId, line.priceOptionId),
        quantity: line.quantity,
        discountAmount: manualDiscountFor(line),
      })),
      [...grantedEntries, ...chosenEntries],
    );
  }, [lines, amountFor, manualDiscountFor, grantedIds, chosenDiscounts, activeDiscounts]);

  // The hand-typed line discounts alone, shown as their own row in the totals
  // below since they carry no name the way a ticked discount does.
  const manualDiscountTotal = useMemo(
    () => lines.reduce((sum, line) => sum + manualDiscountFor(line), 0),
    [lines, manualDiscountFor],
  );

  const addLine = () => {
    const firstUnused = items.find((item) => !lines.some((line) => line.feeItemId === item.id));
    if (!firstUnused) return;
    setLines((current) => [
      ...current,
      {
        feeItemId: firstUnused.id,
        quantity: 1,
        accountIds: firstUnused.accounts.map((account) => account.id),
        description: firstUnused.name,
        discountMode: 'FIXED',
        discountValue: '',
      },
    ]);
  };

  const toggleLineAccount = (index: number, accountId: string) =>
    setLines((current) =>
      current.map((entry, i) =>
        i === index
          ? {
              ...entry,
              accountIds: entry.accountIds.includes(accountId)
                ? entry.accountIds.filter((id) => id !== accountId)
                : [...entry.accountIds, accountId],
            }
          : entry,
      ),
    );

  // Reads the actual fee structure written for the student's class this
  // term, rather than every fee item the school has ever defined.
  const addStandardItems = async () => {
    if (!invoice.data) return;

    const result = await resolveFeeStructure.mutateAsync({
      studentId: invoice.data.studentId,
      termId: invoice.data.termId,
    });

    if (!result.structureId) {
      toast.error('No fee structure set up yet', {
        description: "This student's class has no fee structure for this term. Add items one at a time, or set one up under Fees first.",
      });
      return;
    }

    // The structure's own call on each item, which can disagree with that
    // fee item's school-wide default — applied to the dropdown labels below
    // so the screen never keeps showing "(optional)" on a charge this
    // particular structure actually bills to everyone.
    setStructureOptional(new Map(result.lines.map((line) => [line.feeItemId, line.isOptional])));
    setStructureAmounts(new Map(result.lines.map((line) => [line.feeItemId, line.amount])));

    // Every line on the structure, mandatory and optional alike — "Add all
    // standard fees" means all of them. `isOptional` is only a display label
    // for the dropdown above; filtering on it here was the bug, since it
    // silently dropped optional charges the button is supposed to add.
    const standardIds = result.lines.map((line) => line.feeItemId);

    // Adds whatever is missing rather than replacing the list outright — an
    // optional item already on this invoice (from the original bulk run, or
    // added by hand since) must not vanish just because the standard set
    // was pulled in on top of it.
    let added = 0;
    setLines((current) => {
      const existingIds = new Set(current.map((line) => line.feeItemId));
      const missing = standardIds
        .filter((feeItemId) => !existingIds.has(feeItemId))
        .map((feeItemId) => {
          const item = items.find((entry) => entry.id === feeItemId);
          return {
            feeItemId,
            quantity: 1,
            accountIds: item?.accounts.map((account) => account.id) ?? [],
            description: item?.name ?? '',
            discountMode: 'FIXED' as const,
            discountValue: '',
          };
        });
      added = missing.length;
      return [...current, ...missing];
    });

    if (added === 0) {
      toast.info('Already up to date', {
        description: `Every standard charge from ${result.structureName} is already on this invoice.`,
      });
    } else {
      toast.success('Standard fees added', { description: result.structureName ?? undefined });
    }
  };

  if (invoice.isPending) {
    return (
      <PageContainer width="narrow">
        <PageHeader loading title="" breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }]} />
        <LoadingState label="Loading invoice…" />
      </PageContainer>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Invoice" breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }]} />
        <ErrorState error={invoice.error} onRetry={() => void invoice.refetch()} />
      </PageContainer>
    );
  }

  const record = invoice.data;
  const hasPayments = record.amountPaid > 0;
  // A follow-up that only carries an earlier invoice's balance was born with no
  // charges; its due date and note can still change without inventing one.
  const hadNoCharges = record.lines.every((line) => line.carriedFromInvoiceId);
  // Whether the person touched the charges or discounts at all. Only then are
  // they sent — and re-priced — and only then is a reason owed.
  const chargesChanged = initialised && draftKey(lines, chosenDiscounts) !== initialKey;
  const reasonMissing = chargesChanged && lines.length > 0 && reason.trim().length === 0;
  const valid = Boolean(dueDate && (lines.length > 0 || hadNoCharges)) && !reasonMissing;

  // What a payment has already been itemised to on this invoice, by fee item.
  // Such a charge can be repriced upward but not removed or swapped for another.
  const paidOnFeeItem = (feeItemId: string) =>
    record.lines.find((line) => !line.carriedFromInvoiceId && line.feeItemId === feeItemId)
      ?.amountPaid ?? 0;

  // The previews below leave out a balance brought forward, so it is added back
  // here to compare like with like against what has been paid. A hint only: the
  // server prices the real bill and is the one that refuses.
  const previewTotal = subtotal - discountPreview.total + record.broughtForward;
  const belowPaid = hasPayments && chargesChanged && previewTotal < record.amountPaid;

  // Same student-centric trail as the invoice detail page this is reached
  // from — an invoice always belongs to exactly one student.
  const breadcrumbs = [
    { label: 'Students', to: '/students' },
    { label: record.studentName, to: `/students/${record.studentId}?tab=finance` },
    { label: record.invoiceNo, to: `/finance/invoices/${record.id}` },
    { label: 'Edit' },
  ];

  if (record.status === 'CANCELLED') {
    return (
      <PageContainer width="narrow">
        <PageHeader title={`Edit ${record.invoiceNo}`} breadcrumbs={breadcrumbs} />
        <Alert tone="warning">
          This invoice has been cancelled and can no longer be edited.
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(`/finance/invoices/${record.id}`)}>
            Back to invoice
          </Button>
        </div>
      </PageContainer>
    );
  }

  const submit = async () => {
    if (!valid) return;
    try {
      await updateInvoice.mutateAsync({
        id: record.id,
        input: {
          dueDate,
          note,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          // Sent only when the charges were touched. Sending them re-prices the
          // whole bill from today's fees, which a due-date edit must never do.
          ...(chargesChanged && lines.length > 0
            ? {
                lines: lines.map((line) => ({
                  feeItemId: line.feeItemId,
                  quantity: line.quantity,
                  discountAmount: manualDiscountFor(line),
                  accountIds: line.accountIds,
                  priceOptionId: line.priceOptionId,
                })),
                discounts: chosenDiscounts,
              }
            : {}),
        },
      });
      navigate(`/finance/invoices/${record.id}`);
    } catch (error) {
      if (!isApiError(error)) throw error;
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={`Edit ${record.invoiceNo}`}
        description="The student and term stay fixed. Every change you save is kept in this invoice's version history, so the earlier wording is never lost."
        breadcrumbs={breadcrumbs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Student and term</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={updateInvoice.error} />

          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{record.studentName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {record.admissionNo}
                {record.className ? ` · ${record.className}` : ''} · {record.termName} ·{' '}
                {record.sessionName}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-edit-due" required>
              Due date
            </Label>
            <Input
              data-cy="finance-invoice-edit-due"
              id="invoice-edit-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Charges</CardTitle>
              <CardDescription>Add, remove or reprice the fee items being billed.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                data-cy="finance-invoice-edit-add-all-standard-fees"
                variant="outline"
                size="sm"
                onClick={() => void addStandardItems()}
                loading={resolveFeeStructure.isPending}
              >
                Add all standard fees
              </Button>
              <Button data-cy="finance-invoice-edit-add-a-line" variant="outline" size="sm" onClick={addLine} disabled={items.length === 0}>
                <Plus />
                Add a line
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasPayments && (
            <Alert tone="info" data-cy="finance-invoice-edit-paid-notice">
              {formatCurrency(record.amountPaid, 'NGN', { showDecimals: false })} has already been
              paid on this invoice. You can still correct the charges, but the total cannot fall
              below what was paid, and a charge that money was put towards cannot be removed.
            </Alert>
          )}

          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No charges yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line, index) => {
                const item = items.find((entry) => entry.id === line.feeItemId);
                const missing = !item;
                const gross = grossFor(line);
                const lineDiscount = manualDiscountFor(line);
                // Money already put towards this charge pins it: it can be
                // repriced upward, but not removed or swapped for another item.
                const paidTowards = paidOnFeeItem(line.feeItemId);
                // Until the charges are touched this screen shows the invoice
                // as it was billed. Today's fee list can have moved since, and
                // pricing off it would show an amount nobody has been asked to pay.
                const saved = chargesChanged
                  ? undefined
                  : record.lines.find(
                      (entry) => !entry.carriedFromInvoiceId && entry.feeItemId === line.feeItemId,
                    );
                const shownGross = saved ? saved.unitAmount * saved.quantity : gross;
                const shownDiscount = saved ? saved.discountAmount : lineDiscount;
                return (
                  <li key={index} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={`edit-line-item-${index}`}>Fee item</Label>
                        {missing ? (
                          <p
                            id={`edit-line-item-${index}`}
                            className="rounded-md border border-dashed border-danger/50 px-3 py-2 text-sm text-danger"
                          >
                            {line.description} — this fee item no longer exists.
                            {paidTowards === 0 && ' Remove this line to save changes.'}
                          </p>
                        ) : (
                          <NativeSelect
                            data-cy="finance-invoice-edit-fee-item-id"
                            id={`edit-line-item-${index}`}
                            value={line.feeItemId}
                            disabled={paidTowards > 0}
                            onChange={(event) => {
                              // A fresh item is a fresh choice — any quantity
                              // or account set for the old one should not
                              // silently carry over onto a different charge.
                              const next = items.find((option) => option.id === event.target.value);
                              setLines((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        feeItemId: event.target.value,
                                        quantity: 1,
                                        accountIds: next?.accounts.map((a) => a.id) ?? [],
                                        description: next?.name ?? entry.description,
                                        priceOptionId: undefined,
                                        discountMode: 'FIXED',
                                        discountValue: '',
                                      }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            {items.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                                {isOptionalFor(option.id) ? ' (optional)' : ''}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      </div>
                      {!missing && item.priceOptions.length > 0 && (
                        <div className="w-36 shrink-0 space-y-1.5">
                          <Label htmlFor={`edit-line-price-${index}`}>Price</Label>
                          <NativeSelect
                            data-cy="finance-invoice-edit-price-option"
                            id={`edit-line-price-${index}`}
                            value={line.priceOptionId ?? ''}
                            onChange={(event) => {
                              const priceOptionId = event.target.value || undefined;
                              setLines((current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, priceOptionId } : entry,
                                ),
                              );
                            }}
                          >
                            <option value="">
                              Standard — {formatCurrency(item.amount, 'NGN', { showDecimals: false })}
                            </option>
                            {item.priceOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label} —{' '}
                                {formatCurrency(option.amount, 'NGN', { showDecimals: false })}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      )}
                      {!missing && item.hasQuantity && (
                        <div className="w-20 shrink-0 space-y-1.5">
                          <Label htmlFor={`edit-line-qty-${index}`}>Qty</Label>
                          <Input
                            data-cy="finance-invoice-edit-quantity"
                            id={`edit-line-qty-${index}`}
                            type="number"
                            min={1}
                            max={100}
                            value={line.quantity}
                            onChange={(event) => {
                              const quantity = Math.max(
                                1,
                                Math.min(100, Math.round(Number(event.target.value)) || 1),
                              );
                              setLines((current) =>
                                current.map((entry, i) => (i === index ? { ...entry, quantity } : entry)),
                              );
                            }}
                          />
                        </div>
                      )}
                      {!missing && (
                        <div className="w-48 shrink-0 space-y-1.5">
                          <Label htmlFor={`edit-line-discount-${index}`}>Discount</Label>
                          <div className="flex gap-1.5">
                            <NativeSelect
                              data-cy="finance-invoice-edit-discount-mode"
                              aria-label="Discount type"
                              className="w-16 shrink-0 px-1"
                              value={line.discountMode}
                              onChange={(event) => {
                                const discountMode = event.target.value as LineDraft['discountMode'];
                                setLines((current) =>
                                  current.map((entry, i) =>
                                    i === index ? { ...entry, discountMode } : entry,
                                  ),
                                );
                              }}
                            >
                              <option value="FIXED">₦</option>
                              <option value="PERCENTAGE">%</option>
                            </NativeSelect>
                            <Input
                              data-cy="finance-invoice-edit-discount-value"
                              id={`edit-line-discount-${index}`}
                              type="number"
                              min={0}
                              max={line.discountMode === 'PERCENTAGE' ? 100 : undefined}
                              placeholder="0"
                              className="min-w-0 flex-1"
                              value={line.discountValue}
                              onChange={(event) => {
                                const discountValue = event.target.value;
                                setLines((current) =>
                                  current.map((entry, i) =>
                                    i === index ? { ...entry, discountValue } : entry,
                                  ),
                                );
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {!missing && (
                        <div className="shrink-0 text-right text-sm">
                          <p className="text-xs text-muted-foreground">
                            {item.hasQuantity ? 'Line total' : 'Amount'}
                          </p>
                          {shownDiscount > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground line-through">
                                {formatCurrency(shownGross, 'NGN', { showDecimals: false })}
                              </p>
                              <p className="font-medium tabular-nums">
                                {formatCurrency(shownGross - shownDiscount, 'NGN', {
                                  showDecimals: false,
                                })}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium tabular-nums">
                              {formatCurrency(shownGross, 'NGN', { showDecimals: false })}
                            </p>
                          )}
                        </div>
                      )}
                      <Button
                        data-cy="finance-invoice-edit-remove-line"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove line"
                        disabled={paidTowards > 0}
                        title={
                          paidTowards > 0
                            ? 'Money has been put towards this charge, so it cannot be removed.'
                            : undefined
                        }
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {paidTowards > 0 && (
                      <p
                        className="text-xs text-muted-foreground"
                        data-cy="finance-invoice-edit-line-paid"
                      >
                        {formatCurrency(paidTowards, 'NGN', { showDecimals: false })} has been paid
                        towards this charge. It can be repriced upward, but not removed or brought
                        below that.
                      </p>
                    )}
                    {item && item.accounts.length === 1 && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Landmark className="size-3.5 shrink-0" aria-hidden="true" />
                        Pay into {item.accounts[0].bankName} · {item.accounts[0].accountNumber} ·{' '}
                        {item.accounts[0].accountName}
                      </p>
                    )}
                    {item && item.accounts.length > 1 && (
                      <fieldset className="space-y-1">
                        <legend className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Landmark className="size-3.5 shrink-0" aria-hidden="true" />
                          Pay into
                        </legend>
                        {item.accounts.map((account) => (
                          <label
                            key={account.id}
                            className="flex items-center gap-2 pl-5 text-xs text-muted-foreground"
                          >
                            <input
                              data-cy="finance-invoice-edit-line-account"
                              type="checkbox"
                              className="size-3.5 rounded border-input"
                              checked={line.accountIds.includes(account.id)}
                              onChange={() => toggleLineAccount(index, account.id)}
                            />
                            {account.label ? `${account.label} — ` : ''}
                            {account.bankName} · {account.accountNumber} · {account.accountName}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invoice-edit-note">Note</Label>
            <Textarea
              data-cy="finance-invoice-edit-note"
              id="invoice-edit-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional — appears on the invoice."
            />
          </div>

          <InvoiceDiscountsPicker
            discounts={activeDiscounts}
            feeItems={lineFeeItems}
            grantedIds={grantedIds}
            selected={chosenDiscounts}
            onChange={setChosenDiscounts}
            applied={discountPreview.applied}
            studentName={record.studentName}
          />

          {/* Owed only once the charges have actually changed: a due-date or
              note edit needs no explanation, and asking for one would only
              teach people to type a full stop. */}
          {chargesChanged && (
            <div className="space-y-1.5">
              <Label htmlFor="invoice-edit-reason" required>
                Why are the charges changing?
              </Label>
              <Textarea
                data-cy="finance-invoice-edit-reason"
                id="invoice-edit-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Uniform was added to this invoice by mistake."
              />
              <p className="text-xs text-muted-foreground">
                Kept with this change in the invoice's version history.
              </p>
            </div>
          )}

          {belowPaid && (
            <Alert tone="warning" data-cy="finance-invoice-edit-below-paid">
              These changes bring the invoice to{' '}
              {formatCurrency(previewTotal, 'NGN', { showDecimals: false })}, which is less than the{' '}
              {formatCurrency(record.amountPaid, 'NGN', { showDecimals: false })} already paid. It
              will be refused — reverse or reduce a payment first.
            </Alert>
          )}

          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            {!chargesChanged ? (
              <Row
                label="Total for this term"
                value={formatCurrency(record.subtotal - record.discountTotal, 'NGN', {
                  showDecimals: false,
                })}
                emphasis
              />
            ) : (
              <>
                {(discountPreview.applied.length > 0 || manualDiscountTotal > 0) && (
                  <>
                    <Row
                      label="Subtotal"
                      value={formatCurrency(subtotal, 'NGN', { showDecimals: false })}
                    />
                    {manualDiscountTotal > 0 && (
                      <Row
                        label="Charge discounts"
                        value={`− ${formatCurrency(manualDiscountTotal, 'NGN', { showDecimals: false })}`}
                      />
                    )}
                    {discountPreview.applied.map((entry) => (
                      <Row
                        key={entry.discountId}
                        label={entry.name}
                        value={`− ${formatCurrency(entry.amount, 'NGN', { showDecimals: false })}`}
                      />
                    ))}
                  </>
                )}
                <Row
                  label="Total for this term"
                  value={formatCurrency(subtotal - discountPreview.total, 'NGN', {
                    showDecimals: false,
                  })}
                  emphasis
                />
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          data-cy="finance-invoice-edit-cancel"
          variant="outline"
          onClick={() => navigate(`/finance/invoices/${record.id}`)}
        >
          Cancel
        </Button>
        <Button
          data-cy="finance-invoice-edit-save"
          onClick={() => void submit()}
          loading={updateInvoice.isPending}
          disabled={!valid}
        >
          Save changes
        </Button>
      </div>
    </PageContainer>
  );
}
