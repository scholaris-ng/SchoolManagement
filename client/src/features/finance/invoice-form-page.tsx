import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { toast } from '@/lib/toast-bus';
import { useCurrentTerm, useTerms } from '@/features/academics/api';
import { useStudent, useStudentSearch } from '@/features/students/api';
import { useCreateInvoice, useFeeItems, useResolveFeeStructure } from './api';
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
import { Row } from './invoice-form-page-parts';

interface LineDraft {
  feeItemId: string;
  /** Only ever editable, or worth more than 1, for a fee item marked `hasQuantity`. */
  quantity: number;
  /** Which of the fee item's own accounts this charge is billed under. */
  accountIds: string[];
  /** One of the fee item's own named prices; unset bills the item's own `amount`. */
  priceOptionId?: string;
}

/**
 * Issuing one invoice.
 *
 * Written as a working sheet rather than a form: the bursar picks a student,
 * pulls in fee items, and sees the total — including anything carried forward
 * from last term — recalculate as they go.
 */
export function InvoiceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createInvoice = useCreateInvoice();
  const resolveFeeStructure = useResolveFeeStructure();

  const currentTerm = useCurrentTerm();
  const terms = useTerms();
  const feeItems = useFeeItems();

  const preselectedStudentId = searchParams.get('studentId') ?? undefined;
  const [studentQuery, setStudentQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string; admissionNo: string } | null>(
    preselectedStudentId
      ? { id: preselectedStudentId, name: 'Selected student', admissionNo: '' }
      : null,
  );
  const results = useStudentSearch(studentQuery, { enabled: studentQuery.length >= 2 });
  const preselectedStudent = useStudent(preselectedStudentId);

  // Fills in the real name and admission number once the record for a
  // student passed via `?studentId=` has loaded, replacing the placeholder
  // set above so the form never blocks on this fetch. Guarded so it never
  // overwrites a different student the bursar picked via "Change".
  useEffect(() => {
    if (!preselectedStudent.data) return;
    setStudent((current) =>
      current && current.id === preselectedStudent.data.id
        ? {
            id: preselectedStudent.data.id,
            name: preselectedStudent.data.fullName,
            admissionNo: preselectedStudent.data.admissionNo,
          }
        : current,
    );
  }, [preselectedStudent.data]);

  const [termId, setTermId] = useState('');
  const [dueDate, setDueDate] = useState(
    toDateInputValue(new Date(Date.now() + 30 * 86_400_000)),
  );
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  // A fee item's own "(optional)" is its school-wide default; a resolved
  // structure can override that per item (boarding marked optional
  // everywhere except the one structure it is compulsory under). Filled in
  // once "Add all standard fees" has resolved a structure, so the dropdown
  // stops showing a default that this student's actual bill does not use.
  const [structureOptional, setStructureOptional] = useState<Map<string, boolean>>(new Map());
  // Same idea, for price: a structure can charge a fee item at something
  // other than its school-wide default (the whole point of writing one), and
  // the server bills from that override, never the item's own `amount`, once
  // a structure applies — see `InvoicesService.structureAmountsFor`. Filled
  // in alongside `structureOptional` so this screen's total agrees with what
  // gets charged instead of quietly pricing off the item's default.
  const [structureAmounts, setStructureAmounts] = useState<Map<string, number>>(new Map());

  const effectiveTermId = termId || currentTerm.data?.id || '';
  // Memoised so the totals below are not recomputed on every keystroke just
  // because the fallback array is a new reference.
  const items = useMemo(() => feeItems.data?.items ?? [], [feeItems.data]);
  const isOptionalFor = (feeItemId: string) =>
    structureOptional.get(feeItemId) ?? items.find((item) => item.id === feeItemId)?.isOptional ?? false;
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

  const addLine = () => {
    const firstUnused = items.find((item) => !lines.some((line) => line.feeItemId === item.id));
    if (!firstUnused) return;
    setLines((current) => [
      ...current,
      {
        feeItemId: firstUnused.id,
        quantity: 1,
        accountIds: firstUnused.accounts.map((account) => account.id),
      },
    ]);
  };

  // Reads the actual fee structure written for the student's class this
  // term, rather than every fee item the school has ever defined — a school
  // with separate Primary and Secondary charges should not see both added
  // to a Primary pupil's bill.
  const addStandardItems = async () => {
    if (!student) {
      toast.error('Choose the student first');
      return;
    }
    if (!effectiveTermId) {
      toast.error('Choose the term first');
      return;
    }

    const result = await resolveFeeStructure.mutateAsync({
      studentId: student.id,
      termId: effectiveTermId,
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
    // silently dropped optional charges (transport, boarding) the button is
    // supposed to add. A line that does not apply to this pupil is the
    // bursar's to remove, same as any other line added by mistake.
    const standardIds = result.lines.map((line) => line.feeItemId);

    // Adds whatever is missing rather than replacing the list outright — a
    // line already on the invoice (an optional item the bursar added by
    // hand, say) must not vanish just because the standard set was pulled
    // in on top of it.
    let added = 0;
    setLines((current) => {
      const existingIds = new Set(current.map((line) => line.feeItemId));
      const missing = standardIds
        .filter((feeItemId) => !existingIds.has(feeItemId))
        .map((feeItemId) => ({
          feeItemId,
          quantity: 1,
          accountIds: items.find((item) => item.id === feeItemId)?.accounts.map((a) => a.id) ?? [],
        }));
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

  const valid = Boolean(student && effectiveTermId && dueDate && lines.length > 0);

  // Reached from a student's own Fees tab, this should hand the bursar back
  // to that student rather than dropping them on the general invoices list
  // they never asked to see.
  const backTo = preselectedStudentId
    ? `/students/${preselectedStudentId}?tab=finance`
    : '/finance/invoices';
  const breadcrumbs = preselectedStudentId
    ? [
        { label: 'Students', to: '/students' },
        { label: student?.name ?? 'Student', to: backTo },
        { label: 'New invoice' },
      ]
    : [
        { label: 'Finance', to: '/finance' },
        { label: 'Invoices', to: '/finance/invoices' },
        { label: 'New' },
      ];

  const submit = async () => {
    if (!student || !valid) return;
    try {
      const invoice = await createInvoice.mutateAsync({
        studentId: student.id,
        termId: effectiveTermId,
        dueDate,
        lines: lines.map((line) => ({ ...line, discountAmount: 0 })),
        note: note.trim() || undefined,
      });
      navigate(`/finance/invoices/${invoice.id}`);
    } catch (error) {
      if (!isApiError(error)) throw error;
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="New invoice"
        description="Bill one family for a term. Any unpaid balance from a previous term is carried forward automatically."
        breadcrumbs={breadcrumbs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Student and term</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={createInvoice.error} />

          <div className="space-y-1.5">
            <Label htmlFor="invoice-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{student.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{student.admissionNo}</p>
                </div>
                <Button data-cy="finance-invoice-form-change" variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  data-cy="finance-invoice-form-student-query"
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
                          data-cy="finance-invoice-form-match-classname"
                          type="button"
                          onClick={() =>
                            setStudent({
                              id: match.id,
                              name: match.fullName,
                              admissionNo: match.admissionNo,
                            })
                          }
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1 truncate">{match.fullName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {match.admissionNo}
                            {match.className ? ` · ${match.className}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-term" required>
                Term
              </Label>
              <NativeSelect
                data-cy="invoice-term"
                id="invoice-term"
                value={effectiveTermId}
                onChange={(event) => setTermId(event.target.value)}
              >
                <option value="">Select a term</option>
                {(terms.data ?? []).map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} · {term.sessionName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due" required>
                Due date
              </Label>
              <Input
                data-cy="invoice-due"
                id="invoice-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Charges</CardTitle>
              <CardDescription>
                Add the fee items being billed. Optional items are only for families who take them.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                data-cy="finance-invoice-form-add-all-standard-fees"
                variant="outline"
                size="sm"
                onClick={() => void addStandardItems()}
                loading={resolveFeeStructure.isPending}
              >
                Add all standard fees
              </Button>
              <Button data-cy="finance-invoice-form-add-a-line" variant="outline" size="sm" onClick={addLine} disabled={items.length === 0}>
                <Plus />
                Add a line
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No charges yet. Add the standard fees, or pick items one at a time.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line, index) => {
                const item = items.find((entry) => entry.id === line.feeItemId);
                return (
                  <li key={index} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={`line-item-${index}`}>Fee item</Label>
                        <NativeSelect
                          data-cy="finance-invoice-form-fee-item-id"
                          id={`line-item-${index}`}
                          value={line.feeItemId}
                          onChange={(event) => {
                            // A fresh item is a fresh choice — any quantity or
                            // account picked for the old one should not
                            // silently carry over onto a different charge.
                            const next = items.find((option) => option.id === event.target.value);
                            setLines((current) =>
                              current.map((entry, i) =>
                                i === index
                                  ? {
                                      feeItemId: event.target.value,
                                      quantity: 1,
                                      accountIds: next?.accounts.map((a) => a.id) ?? [],
                                      priceOptionId: undefined,
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
                      </div>
                      {item && item.priceOptions.length > 0 && (
                        <div className="w-36 shrink-0 space-y-1.5">
                          <Label htmlFor={`line-price-${index}`}>Price</Label>
                          <NativeSelect
                            data-cy="finance-invoice-form-price-option"
                            id={`line-price-${index}`}
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
                      {item?.hasQuantity && (
                        <div className="w-20 shrink-0 space-y-1.5">
                          <Label htmlFor={`line-qty-${index}`}>Qty</Label>
                          <Input
                            data-cy="finance-invoice-form-quantity"
                            id={`line-qty-${index}`}
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
                      <div className="shrink-0 text-right text-sm">
                        <p className="text-xs text-muted-foreground">
                          {item?.hasQuantity ? 'Line total' : 'Amount'}
                        </p>
                        <p className="font-medium tabular-nums">
                          {formatCurrency(
                            amountFor(line.feeItemId, line.priceOptionId) * line.quantity,
                            'NGN',
                            { showDecimals: false },
                          )}
                        </p>
                      </div>
                      <Button
                        data-cy="finance-invoice-form-remove-line"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove line"
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {/* One account is shown, not chosen — there is nothing to
                        narrow down; two or more need an actual pick, and
                        default to all of them, same as a fee structure line. */}
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
                              data-cy="finance-invoice-form-line-account"
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
            <Label htmlFor="invoice-note">Note</Label>
            <Textarea
              data-cy="invoice-note"
              id="invoice-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional — appears on the invoice."
            />
          </div>

          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <Row
              label="Total for this term"
              value={formatCurrency(subtotal, 'NGN', { showDecimals: false })}
              emphasis
            />
          </dl>

          <Alert tone="info">
            Any unpaid balance from a previous term is added by the server when the invoice is
            created, so it appears on the final document.
          </Alert>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button data-cy="finance-invoice-form-cancel" variant="outline" onClick={() => navigate(backTo)}>
          Cancel
        </Button>
        <Button data-cy="finance-invoice-form-create-invoice" onClick={() => void submit()} loading={createInvoice.isPending} disabled={!valid}>
          Create invoice
        </Button>
      </div>
    </PageContainer>
  );
}
