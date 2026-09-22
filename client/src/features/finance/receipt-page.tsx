import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Mail, Printer } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn, humanizeEnum } from '@/lib/utils';
import { env } from '@/lib/env';
import { useAuth } from '@/app/providers/auth-provider';
import { useMarkReceiptItems, useReceipt } from './api';
import { EmailReceiptDialog } from './email-receipt-dialog';
import { PrintReceiptDialog, type PrintMode } from './print-receipt-dialog';
import { POS_RECEIPT_SELECTOR, POS_WIDTH_MM, PosReceipt, isPartPayment } from './receipt-pos';
import { ShareReceiptButton } from './whatsapp-share-buttons';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/data/qr-code';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { Receipt } from '@/types/finance';

const POS_PAGE_STYLE_ID = 'pos-page-style';

/**
 * Sends the receipt to the printer in one of two shapes: the ordinary page, or
 * the narrow copy for a POS thermal roll.
 *
 * The mode is a `data-print-mode` attribute on the body — the print CSS in
 * `index.css` reads it to decide what appears on paper — and it is cleared
 * again once printing is over, so a later Ctrl+P is an ordinary print.
 *
 * A POS print also sets the paper size, to the roll's width and the height of
 * the receipt itself: a fixed length would either cut a long receipt in two or
 * feed a short one out with a blank tail. `@page` cannot be scoped by a
 * selector, which is why it is injected for the print and removed after.
 */
function usePrintReceipt() {
  useEffect(() => {
    const reset = () => {
      delete document.body.dataset.printMode;
      document.getElementById(POS_PAGE_STYLE_ID)?.remove();
    };
    window.addEventListener('afterprint', reset);
    return () => {
      window.removeEventListener('afterprint', reset);
      reset();
    };
  }, []);

  return (mode: PrintMode) => {
    document.body.dataset.printMode = mode;
    document.getElementById(POS_PAGE_STYLE_ID)?.remove();

    if (mode === 'pos') {
      const copy = document.querySelector<HTMLElement>(POS_RECEIPT_SELECTOR);
      // CSS pixels to millimetres, plus a little slack: a page a hair too short
      // spills its last line onto a second, otherwise blank, page.
      const heightMm = copy ? Math.ceil((copy.getBoundingClientRect().height * 25.4) / 96) + 4 : 200;
      const style = document.createElement('style');
      style.id = POS_PAGE_STYLE_ID;
      style.textContent = `@page { size: ${POS_WIDTH_MM}mm ${heightMm}mm; margin: 0; }`;
      document.head.appendChild(style);
    }

    window.print();
  };
}

/**
 * A printable receipt.
 *
 * Parents in Nigeria routinely need a physical receipt for a bursar, an
 * employer or their own records, so this prints cleanly onto a half sheet and
 * carries a verification code the school can check later.
 */
export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const receipt = useReceipt(paymentId);
  const [showItems, setShowItems] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const printReceipt = usePrintReceipt();
  const { can } = useAuth();
  const canMarkItems = can({ anyOf: ['payment.manage', 'invoice.manage'] });

  const breadcrumbs = [
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

  return (
    <>
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader
            title={`Receipt ${record.receiptNo}`}
            description={`${record.studentName} · ${formatDateTime(record.paidAt)}`}
            breadcrumbs={[...breadcrumbs, { label: record.receiptNo }]}
            actions={
              reversed ? undefined : (
                <>
                  <ShareReceiptButton paymentId={record.paymentId} includeCharges={showItems} />
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
            {showItems && canMarkItems && (
              <p className="pl-6 text-xs text-muted-foreground">
                Tick the fee items this payment was for, then save — one invoice at a time.
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
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatCurrency(allocation.invoiceTotal, 'NGN', { showDecimals: false })}
                          </td>
                        </tr>
                        {showItems && (
                          <AllocationLines
                            allocation={allocation}
                            paymentId={record.paymentId}
                            interactive={canMarkItems}
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
    </PageContainer>
      <PosReceipt record={record} verifyUrl={verifyUrl} showItems={showItems} />
      <PrintReceiptDialog open={printOpen} onOpenChange={setPrintOpen} onPrint={printReceipt} />
      <EmailReceiptDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentId={record.paymentId}
        studentId={record.studentId}
      />
    </>
  );
}

/**
 * One invoice's fee-item checkboxes, with their own "Save" beneath them.
 *
 * Ticking a box only updates this component's own draft — nothing reaches
 * the server until Save is pressed — so marking several items on the same
 * invoice is a handful of instant clicks followed by one save, not a round
 * trip waited out between each tick.
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

  const dirty =
    checked.size !== savedPaidIds.length || savedPaidIds.some((id) => !checked.has(id));

  return (
    <>
      {allocation.lines.map((line) => {
        const paid = interactive ? checked.has(line.id) : line.paid;
        return (
          <tr key={line.id} className="text-xs text-muted-foreground">
            {/* The cell itself always renders, print included, so the row
                keeps the same three columns as the allocation row above it;
                only the checkbox inside is screen-only — the checkmark ahead
                of the description is what a printed copy shows instead. */}
            <td className="w-6 py-1">
              {interactive && (
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
            </td>
            <td className={cn('py-1 text-right tabular-nums', paid && 'text-success')}>
              {formatCurrency(line.amount, 'NGN', { showDecimals: false })}
            </td>
          </tr>
        );
      })}
      {interactive && dirty && (
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
