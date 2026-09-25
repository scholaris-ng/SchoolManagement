import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Mail, Printer, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn, humanizeEnum } from '@/lib/utils';
import { env } from '@/lib/env';
import { useAuth } from '@/app/providers/auth-provider';
import { useMarkReceiptItems, useReceipt, useSetReceiptItemAmounts } from './api';
import { useDocumentDeliveries, useLogDocumentPrint } from './use-document-deliveries';
import { DocumentDeliveryLog, deliverySummary } from './document-delivery-log';
import { EmailReceiptDialog } from './email-receipt-dialog';
import { PrintReceiptDialog, type PrintMode } from './print-receipt-dialog';
import { usePrintMode } from './pos-print';
import { PosReceipt, isPartPayment } from './receipt-pos';
import { ShareReceiptButton } from './whatsapp-share-buttons';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode } from '@/components/data/qr-code';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { DocumentDelivery, Receipt } from '@/types/finance';

/**
 * A printable receipt.
 *
 * Parents in Nigeria routinely need a physical receipt for a bursar, an
 * employer or their own records, so this prints cleanly onto a half sheet and
 * carries a verification code the school can check later.
 */
export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  // Set by the payment form when it was opened from a student's own Fees tab,
  // so this page can hand the bursar back to that student instead of leaving
  // them on the general payments list they never came from.
  const fromStudentId = useSearchParams()[0].get('studentId');
  const receipt = useReceipt(paymentId);
  const [showItems, setShowItems] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const printReceipt = usePrintMode();
  const { can } = useAuth();
  // The same permission gates marking fee items, sending the receipt, and
  // seeing who it has already been sent to — all of it is the office's work.
  const canManageReceipt = can({ anyOf: ['payment.manage', 'invoice.manage'] });

  const logPrint = useLogDocumentPrint('RECEIPT', paymentId ?? '');
  // Read here as well as inside the log card — one shared query — so the header
  // can say whether the family has this receipt before anybody scrolls.
  const deliveries = useDocumentDeliveries('RECEIPT', canManageReceipt ? paymentId : undefined);

  /**
   * Printing also notes the print in the delivery register. Logged before the
   * print dialog opens, because `window.print()` blocks this thread until the
   * person dismisses it, and a request fired afterwards would sit waiting on a
   * dialog somebody may have wandered away from.
   */
  const printAndLog = (mode: PrintMode) => {
    logPrint.mutate({
      printFormat: mode === 'pos' ? 'POS' : 'FULL_PAGE',
      includeCharges: showItems,
    });
    printReceipt(mode);
  };

  const breadcrumbs = fromStudentId
    ? [{ label: 'Students', to: '/students' }]
    : [
        { label: 'Finance', to: '/finance' },
        { label: 'Payments', to: '/finance/payments' },
      ];

  if (receipt.isPending) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader loading title="" breadcrumbs={breadcrumbs} />
        </div>
        <LoadingState label="Loading receipt…" />
      </PageContainer>
    );
  }

  if (receipt.isError || !receipt.data) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader title="Receipt" breadcrumbs={breadcrumbs} />
        </div>
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      </PageContainer>
    );
  }

  const record = receipt.data;
  const verifyUrl = `${env.appUrl}/verify/${record.verificationCode}`;
  // Still readable — the family may hold a copy — but no longer proof of
  // payment, so nothing here offers to print it or send it on.
  const reversed = record.status === 'REVERSED';
  const studentPath = `/students/${record.studentId}?tab=finance`;
  const cameFromStudent = fromStudentId === record.studentId;
  const backToStudent = cameFromStudent ? (
    <Button data-cy="finance-receipt-back-to-student" variant="outline" asChild>
      <Link to={studentPath}>
        <ArrowLeft />
        Back to student
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader
            title={`Receipt ${record.receiptNo}`}
            description={`${record.studentName} · ${formatDateTime(record.paidAt)}`}
            breadcrumbs={
              cameFromStudent
                ? [
                    ...breadcrumbs,
                    { label: record.studentName, to: studentPath },
                    { label: record.receiptNo },
                  ]
                : [...breadcrumbs, { label: record.receiptNo }]
            }
            meta={
              // Answered before anyone has to ask: does the family actually
              // hold this receipt? Only shown once the register has loaded, so
              // a slow read never reads as "not sent yet".
              canManageReceipt && deliveries.data ? <DeliveryBadge deliveries={deliveries.data} /> : null
            }
            actions={
              reversed ? (
                backToStudent
              ) : (
                <>
                  {backToStudent}
                  <ShareReceiptButton
                    paymentId={record.paymentId}
                    includeCharges={showItems}
                    // The server logs the share; this is what brings the new
                    // entry onto the page the sender is still looking at.
                    onShared={() => void deliveries.refetch()}
                  />
                  <PermissionGate require={{ anyOf: ['payment.manage', 'invoice.manage'] }}>
                    <Button
                      data-cy="finance-receipt-email"
                      variant="outline"
                      onClick={() => setEmailOpen(true)}
                    >
                      <Mail />
                      Email receipt
                    </Button>
                  </PermissionGate>
                  <Button data-cy="finance-receipt-print" onClick={() => setPrintOpen(true)}>
                    <Printer />
                    Print
                  </Button>
                </>
              )
            }
          />
        </div>

        {!reversed && record.allocations.some((allocation) => allocation.lines.length > 0) && (
          <div className="no-print space-y-1">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                data-cy="finance-receipt-show-items"
                type="checkbox"
                checked={showItems}
                onChange={(event) => setShowItems(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Show each invoice's charges on the receipt
            </label>
            {showItems && canManageReceipt && (
              <p className="pl-6 text-xs text-muted-foreground">
                Tick the fee items this payment was for — ticking one reveals "Part payment" if it
                was only partly covered.
              </p>
            )}
          </div>
        )}

        <Card className="print-page">
          <CardContent className="space-y-5 pt-6">
            {/* Inside the card, not above it, so it prints with the receipt too. */}
            {reversed && (
              <div
                role="alert"
                data-cy="finance-receipt-reversed"
                className="rounded-md border-2 border-danger bg-danger-subtle p-3 text-danger"
              >
                <p className="font-bold uppercase tracking-wide">Reversed · not a valid receipt</p>
                <p className="mt-0.5 text-sm">
                  The school reversed this payment
                  {record.reversalReason ? `: ${record.reversalReason}` : '.'}
                </p>
              </div>
            )}

            <header className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
              {record.schoolLogoUrl ? (
                <img src={record.schoolLogoUrl} alt="" className="size-14 object-contain" />
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{record.schoolName}</h2>
                <p className="text-sm text-muted-foreground">{record.schoolAddress}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
                <p className="font-mono font-semibold">{record.receiptNo}</p>
              </div>
            </header>

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Field label="Received from" value={record.studentName} />
              <Field label="Admission number" value={record.admissionNo} />
              <Field label="Class" value={record.className ?? '—'} />
              <Field label="Date" value={formatDateTime(record.paidAt)} />
              <Field label="Method" value={humanizeEnum(record.method)} />
              <Field label="Received by" value={record.receivedByName} />
            </dl>

            <div className="rounded-md bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount received</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(record.amount, 'NGN')}</p>
              <p className="mt-0.5 text-sm capitalize text-muted-foreground">
                {record.amountInWords}
              </p>
            </div>

            {record.allocations.length > 0 && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Applied to
                </p>
                <table className="w-full text-sm">
                  <caption className="sr-only">Invoices this payment was applied to</caption>
                  <tbody className="divide-y divide-border">
                    {record.allocations.map((allocation, index) => (
                      <Fragment key={index}>
                        <tr>
                          <td className="py-1.5 font-mono text-xs">{allocation.invoiceNo}</td>
                          <td className="py-1.5">
                            {allocation.description}
                            {/* The figure on the right is the invoice's own total, so the
                                itemised charges below add up to it. What this payment put
                                towards it is stated underneath, and a part-payment says so. */}
                            <span className="block text-xs text-muted-foreground">
                              Paid on this receipt{' '}
                              {formatCurrency(allocation.amount, 'NGN', { showDecimals: false })}
                              {isPartPayment(allocation) && (
                                <span className="italic"> · Part payment</span>
                              )}
                            </span>
                            {allocation.discountTotal > 0 && (
                              <span className="block text-xs text-success">
                                Discount applied: −{' '}
                                {formatCurrency(allocation.discountTotal, 'NGN', { showDecimals: false })}
                                {allocation.appliedDiscounts.length > 0 && (
                                  <> ({allocation.appliedDiscounts.map((discount) => discount.name).join(', ')})</>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatCurrency(allocation.invoiceTotal, 'NGN', { showDecimals: false })}
                          </td>
                        </tr>
                        {showItems && (
                          <AllocationLines
                            allocation={allocation}
                            paymentId={record.paymentId}
                            interactive={canManageReceipt}
                          />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
              <div className="space-y-1 text-sm">
                {!reversed && (
                  <p>
                    <span className="text-muted-foreground">Balance after this payment: </span>
                    <span
                      className={`font-semibold tabular-nums ${record.balanceAfter > 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {formatCurrency(record.balanceAfter, 'NGN')}
                    </span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Verification code <span className="font-mono">{record.verificationCode}</span>
                </p>
                <p className="break-all text-xs text-muted-foreground">{verifyUrl}</p>
              </div>
              <QrCode value={verifyUrl} size={84} label="Scan to verify this receipt" />
            </div>
          </CardContent>
        </Card>

        {/* Below the receipt, and never on the paper: this is the office's own
            record of where copies went, not part of the document itself. */}
        {canManageReceipt && (
          <DocumentDeliveryLog
            documentType="RECEIPT"
            documentId={record.paymentId}
            studentId={record.studentId}
            includeCharges={showItems}
            sendable={!reversed}
          />
        )}
    </PageContainer>
      <PosReceipt record={record} verifyUrl={verifyUrl} showItems={showItems} />
      <PrintReceiptDialog open={printOpen} onOpenChange={setPrintOpen} onPrint={printAndLog} />
      <EmailReceiptDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentId={record.paymentId}
        studentId={record.studentId}
      />
    </>
  );
}

/** Whether the family holds this receipt, in one word, next to its number. */
function DeliveryBadge({ deliveries }: { deliveries: DocumentDelivery[] }) {
  const summary = deliverySummary(deliveries);
  return (
    <Badge data-cy="finance-receipt-sent-badge" tone={summary.tone}>
      {summary.label}
    </Badge>
  );
}

/**
 * One invoice's fee-item rows: a tick for "this covered the whole charge",
 * saved a handful at a time, and a "Part payment" button on each row for the
 * exception — a charge this payment only partly covered — that opens just
 * that one row for a typed amount instead of turning the whole list into
 * boxes to fill in.
 */
function AllocationLines({
  allocation,
  paymentId,
  interactive,
}: {
  allocation: Receipt['allocations'][number];
  paymentId: string;
  /** Read-only for anyone without `payment.manage`/`invoice.manage` — just the saved marks, no boxes to tick. */
  interactive: boolean;
}) {
  const markItems = useMarkReceiptItems(paymentId);
  const saveAmounts = useSetReceiptItemAmounts(paymentId);

  const savedPaidIds = allocation.lines.filter((line) => line.paid).map((line) => line.id);
  const savedKey = savedPaidIds.join(',');
  const [checked, setChecked] = useState<Set<string>>(() => new Set(savedPaidIds));

  // Resyncs only from what the server actually holds for this invoice — once
  // this allocation's own save lands, or the receipt is reloaded — so a tick
  // still waiting to be saved is never quietly overwritten mid-edit.
  useEffect(() => {
    setChecked(new Set(savedPaidIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  // Which single line, if any, currently has its part-payment box open — one
  // at a time, since naming an exact amount is meant to be a quick aside, not
  // a form of its own.
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState('');

  const ticksDirty =
    checked.size !== savedPaidIds.length || savedPaidIds.some((id) => !checked.has(id));
  const allChecked = checked.size === allocation.lines.length;

  const savedAmounts = savedAmountsOf(allocation);

  const startEdit = (lineId: string) => {
    setEditingLineId(lineId);
    setDraftAmount(savedAmounts[lineId] ?? '');
  };
  const cancelEdit = () => {
    setEditingLineId(null);
    setDraftAmount('');
  };

  // What every other line already accounts for, so the one being edited is
  // capped at what's left of this payment's own share of the invoice — the
  // same rule the server enforces.
  const otherLinesTotal = Object.entries(savedAmounts)
    .filter(([lineId]) => lineId !== editingLineId)
    .reduce((sum, [, value]) => sum + Number(value), 0);

  // The breakdown is saved wholesale, so naming one line's amount carries
  // every other line's already-saved amount along unchanged.
  const saveLineAmount = (
    line: Receipt['allocations'][number]['lines'][number],
    value: number,
  ) => {
    const nextLines = allocation.lines
      .map((candidate) => {
        if (candidate.id === line.id) {
          return value > 0 ? { lineId: candidate.id, amount: value } : null;
        }
        const saved = savedAmounts[candidate.id];
        return saved != null ? { lineId: candidate.id, amount: Number(saved) } : null;
      })
      .filter((entry): entry is { lineId: string; amount: number } => entry != null);

    saveAmounts.mutate(
      { invoiceId: allocation.invoiceId, lines: nextLines },
      { onSuccess: () => setEditingLineId(null) },
    );
  };

  return (
    <>
      {interactive && allocation.lines.length > 1 && (
        <tr className="no-print">
          <td colSpan={3} className="py-1 text-right">
            <button
              type="button"
              data-cy="finance-receipt-lines-toggle-all"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                setChecked(allChecked ? new Set() : new Set(allocation.lines.map((line) => line.id)))
              }
            >
              {allChecked ? 'Clear all' : 'Mark all as paid'}
            </button>
          </td>
        </tr>
      )}
      {allocation.lines.map((line) => {
        const editing = editingLineId === line.id;
        const paid = interactive && !editing ? checked.has(line.id) : line.paid;
        const maxForLine = Math.max(0, Math.min(roomOn(line), allocation.amount - otherLinesTotal));
        const overLimit = editing && Number(draftAmount) > maxForLine + 0.004;
        return (
          <Fragment key={line.id}>
            <tr className="text-xs text-muted-foreground">
              {/* The cell itself always renders, print included, so the row
                  keeps the same three columns as the allocation row above it;
                  only the checkbox inside is screen-only — the checkmark ahead
                  of the description is what a printed copy shows instead. */}
              <td className="w-6 py-1">
                {interactive && !editing && (
                  <input
                    data-cy="finance-receipt-line-paid"
                    type="checkbox"
                    checked={checked.has(line.id)}
                    disabled={markItems.isPending}
                    onChange={() =>
                      setChecked((current) => {
                        const next = new Set(current);
                        if (next.has(line.id)) next.delete(line.id);
                        else next.add(line.id);
                        return next;
                      })
                    }
                    aria-label={`Mark "${line.description}" as paid for on this receipt`}
                    className="no-print size-3.5 rounded border-input disabled:opacity-50"
                  />
                )}
              </td>
              <td className={cn('py-1 pl-1', paid && 'text-success')}>
                {paid && <Check className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />}
                {line.description}
                {line.isOptional ? ' (optional)' : ''}
                {line.amountPaidByThisPayment != null && (
                  <span className="block text-[11px] text-muted-foreground">
                    {formatCurrency(line.amountPaidByThisPayment, 'NGN', { showDecimals: false })} applied
                    {line.amountPaidByThisPayment < line.amount ? ' · part payment' : ''}
                  </span>
                )}
              </td>
              <td className={cn('py-1 text-right tabular-nums', paid && 'text-success')}>
                {editing ? (
                  <div className="no-print flex items-center justify-end gap-1">
                    <Input
                      data-cy={`finance-receipt-line-amount-${line.id}`}
                      type="number"
                      min={0}
                      max={maxForLine}
                      autoFocus
                      value={draftAmount}
                      disabled={saveAmounts.isPending}
                      onChange={(event) => setDraftAmount(event.target.value)}
                      aria-label={`Amount of this payment for "${line.description}"`}
                      className="h-7 w-24"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Save this amount"
                      data-cy={`finance-receipt-line-save-${line.id}`}
                      loading={saveAmounts.isPending}
                      disabled={!(Number(draftAmount) > 0) || overLimit}
                      onClick={() => saveLineAmount(line, Number(draftAmount))}
                    >
                      <Check />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Cancel"
                      disabled={saveAmounts.isPending}
                      onClick={cancelEdit}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <>
                    {formatCurrency(line.amount, 'NGN', { showDecimals: false })}
                    {line.discountAmount > 0 && (
                      <span className="block text-[11px] font-normal text-success">
                        − {formatCurrency(line.discountAmount, 'NGN', { showDecimals: false })} discount
                      </span>
                    )}
                    {interactive && (line.amountPaidByThisPayment != null || checked.has(line.id)) && (
                      <button
                        type="button"
                        data-cy={`finance-receipt-line-edit-${line.id}`}
                        className="no-print mt-0.5 block w-full text-right text-[11px] text-primary hover:underline"
                        onClick={() => startEdit(line.id)}
                      >
                        {line.amountPaidByThisPayment != null ? 'Edit part payment' : 'Part payment'}
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
            {editing && (
              <tr className="no-print">
                <td colSpan={3} className="pb-1 text-right text-[11px]">
                  {overLimit ? (
                    <span className="text-danger">
                      That's more than this payment put towards this invoice
                    </span>
                  ) : (
                    savedAmounts[line.id] != null && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-danger hover:underline"
                        onClick={() => saveLineAmount(line, 0)}
                      >
                        Remove part payment
                      </button>
                    )
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {interactive && ticksDirty && (
        <tr className="no-print">
          <td colSpan={3} className="py-1.5 text-right">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={markItems.isPending}
              data-cy="finance-receipt-line-save"
              onClick={() =>
                markItems.mutate({ invoiceId: allocation.invoiceId, lineIds: Array.from(checked) })
              }
            >
              Save
            </Button>
          </td>
        </tr>
      )}
    </>
  );
}

/** What this payment may claim for a charge: what is still owed on it, plus whatever this payment itself is currently holding against it. */
function roomOn(line: Receipt['allocations'][number]['lines'][number]): number {
  return line.balance + (line.amountPaidByThisPayment ?? 0);
}

/** What the payment already says it put towards each of this invoice's charges. */
function savedAmountsOf(allocation: Receipt['allocations'][number]): Record<string, string> {
  return Object.fromEntries(
    allocation.lines
      .filter((line) => line.amountPaidByThisPayment != null)
      .map((line) => [line.id, String(line.amountPaidByThisPayment)]),
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
