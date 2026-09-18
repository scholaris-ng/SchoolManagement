import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { toast } from '@/lib/toast-bus';
import { useFeeItems, useInvoice, useResolveFeeStructure, useUpdateInvoice } from './api';
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
}

/**
 * Editing an issued invoice.
 *
 * The student and term are fixed — those are what the bill is *for*, not
 * what it says, so a mistake there means deleting this invoice and raising a
 * fresh one rather than editing this one into a different family's bill.
 * Once any money has landed on the invoice the charges themselves lock too,
 * for the same reason: an amount someone has already paid against cannot
 * quietly become a different amount.
 */
export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoice = useInvoice(id);
  const feeItems = useFeeItems();
  const updateInvoice = useUpdateInvoice();
  const resolveFeeStructure = useResolveFeeStructure();

  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [initialised, setInitialised] = useState(false);

  // Waits on both the invoice and the fee item list: reconstructing which
  // accounts a line was billed under (see below) needs the item's current
  // accounts to match the line's snapshot against.
  useEffect(() => {
    if (!invoice.data || !feeItems.data || initialised) return;
    setDueDate(toDateInputValue(invoice.data.dueDate));
    setNote(invoice.data.note ?? '');
    setLines(
      invoice.data.lines.map((line) => {
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
        return {
          feeItemId: line.feeItemId,
          quantity: line.quantity,
          accountIds: matched.length > 0 ? matched : (item?.accounts.map((a) => a.id) ?? []),
          description: line.description,
        };
      }),
    );
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
  const amountFor = (feeItemId: string) =>
    structureAmounts.get(feeItemId) ?? items.find((item) => item.id === feeItemId)?.amount ?? 0;

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + amountFor(line.feeItemId) * line.quantity, 0),
    [lines, items, structureAmounts],
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
  const amountLocked = record.amountPaid > 0;
  const valid = Boolean(dueDate && lines.length > 0);

  const breadcrumbs = [
    { label: 'Finance', to: '/finance' },
    { label: 'Invoices', to: '/finance/invoices' },
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
          ...(amountLocked
            ? {}
            : {
                lines: lines.map((line) => ({
                  feeItemId: line.feeItemId,
                  quantity: line.quantity,
                  discountAmount: 0,
                  accountIds: line.accountIds,
                })),
              }),
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
        description="The student and term stay fixed — this only changes the due date, the note, and, while nothing has been paid, the charges."
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
              <CardDescription>
                {amountLocked
                  ? 'A payment has already been recorded against this invoice, so the charges are locked.'
                  : 'Add or remove the fee items being billed.'}
              </CardDescription>
            </div>
            {!amountLocked && (
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
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {amountLocked && (
            <Alert tone="info">
              Money has already landed on this invoice, so the amount cannot change. Reverse the
              payment first if the charges genuinely need correcting.
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
                            {!amountLocked && ' Remove this line to save changes.'}
                          </p>
                        ) : (
                          <NativeSelect
                            data-cy="finance-invoice-edit-fee-item-id"
                            id={`edit-line-item-${index}`}
                            value={line.feeItemId}
                            disabled={amountLocked}
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
                      {!missing && item.hasQuantity && !amountLocked && (
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
                        <div className="shrink-0 text-right text-sm">
                          <p className="text-xs text-muted-foreground">
                            {item.hasQuantity
                              ? amountLocked
                                ? `Line total (×${line.quantity})`
                                : 'Line total'
                              : 'Amount'}
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatCurrency(amountFor(line.feeItemId) * line.quantity, 'NGN', {
                              showDecimals: false,
                            })}
                          </p>
                        </div>
                      )}
                      {!amountLocked && (
                        <Button
                          data-cy="finance-invoice-edit-remove-line"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove line"
                          onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
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
                              disabled={amountLocked}
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

          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <Row
              label="Total for this term"
              value={formatCurrency(amountLocked ? record.subtotal - record.discountTotal : subtotal, 'NGN', {
                showDecimals: false,
              })}
              emphasis
            />
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
