import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency, toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { useCurrentTerm, useTerms } from '@/features/academics/api';
import { useStudentSearch } from '@/features/students/api';
import { useCreateInvoice, useFeeItems } from './api';
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
  quantity: number;
  discountAmount: number;
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

  const currentTerm = useCurrentTerm();
  const terms = useTerms();
  const feeItems = useFeeItems();

  const [studentQuery, setStudentQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string; admissionNo: string } | null>(
    searchParams.get('studentId')
      ? { id: searchParams.get('studentId')!, name: 'Selected student', admissionNo: '' }
      : null,
  );
  const results = useStudentSearch(studentQuery, { enabled: studentQuery.length >= 2 });

  const [termId, setTermId] = useState('');
  const [dueDate, setDueDate] = useState(
    toDateInputValue(new Date(Date.now() + 30 * 86_400_000)),
  );
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);

  const effectiveTermId = termId || currentTerm.data?.id || '';
  // Memoised so the totals below are not recomputed on every keystroke just
  // because the fallback array is a new reference.
  const items = useMemo(() => feeItems.data?.items ?? [], [feeItems.data]);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const item = items.find((entry) => entry.id === line.feeItemId);
        return sum + (item?.amount ?? 0) * line.quantity;
      }, 0),
    [lines, items],
  );
  const discountTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.discountAmount, 0),
    [lines],
  );

  const addLine = () => {
    const firstUnused = items.find((item) => !lines.some((line) => line.feeItemId === item.id));
    if (!firstUnused) return;
    setLines((current) => [
      ...current,
      { feeItemId: firstUnused.id, quantity: 1, discountAmount: 0 },
    ]);
  };

  const addMandatoryItems = () => {
    setLines(
      items
        .filter((item) => !item.isOptional && item.isActive)
        .map((item) => ({ feeItemId: item.id, quantity: 1, discountAmount: 0 })),
    );
  };

  const valid = Boolean(student && effectiveTermId && dueDate && lines.length > 0);

  const submit = async () => {
    if (!student || !valid) return;
    try {
      const invoice = await createInvoice.mutateAsync({
        studentId: student.id,
        termId: effectiveTermId,
        dueDate,
        lines,
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
        breadcrumbs={[
          { label: 'Finance', to: '/finance' },
          { label: 'Invoices', to: '/finance/invoices' },
          { label: 'New' },
        ]}
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
              <Button data-cy="finance-invoice-form-add-all-standard-fees" variant="outline" size="sm" onClick={addMandatoryItems}>
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
                const lineTotal = (item?.amount ?? 0) * line.quantity - line.discountAmount;
                return (
                  <li
                    key={index}
                    className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr,5rem,7rem,7rem,auto] sm:items-end"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`line-item-${index}`}>Fee item</Label>
                      <NativeSelect
                        data-cy="finance-invoice-form-fee-item-id"
                        id={`line-item-${index}`}
                        value={line.feeItemId}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, feeItemId: event.target.value } : entry,
                            ),
                          )
                        }
                      >
                        {items.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                            {option.isOptional ? ' (optional)' : ''}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`line-qty-${index}`}>Qty</Label>
                      <Input
                        data-cy="finance-invoice-form-quantity"
                        id={`line-qty-${index}`}
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, quantity: Math.max(1, Number(event.target.value)) }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`line-discount-${index}`}>Discount</Label>
                      <Input
                        data-cy="finance-invoice-form-discount-amount"
                        id={`line-discount-${index}`}
                        type="number"
                        min={0}
                        value={line.discountAmount}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, discountAmount: Math.max(0, Number(event.target.value)) }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-xs text-muted-foreground">Line total</p>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(lineTotal, 'NGN', { showDecimals: false })}
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
            <Row label="Subtotal" value={formatCurrency(subtotal, 'NGN', { showDecimals: false })} />
            <Row
              label="Discounts"
              value={`− ${formatCurrency(discountTotal, 'NGN', { showDecimals: false })}`}
            />
            <Row
              label="Total for this term"
              value={formatCurrency(subtotal - discountTotal, 'NGN', { showDecimals: false })}
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
        <Button data-cy="finance-invoice-form-cancel" variant="outline" onClick={() => navigate('/finance/invoices')}>
          Cancel
        </Button>
        <Button data-cy="finance-invoice-form-create-invoice" onClick={() => void submit()} loading={createInvoice.isPending} disabled={!valid}>
          Create invoice
        </Button>
      </div>
    </PageContainer>
  );
}
