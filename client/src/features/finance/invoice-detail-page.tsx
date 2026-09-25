import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Mail, Pencil, Phone, Printer, Trash2, User } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn, contrastingTextColor } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useDeleteInvoices, useInvoice } from './api';
import { summarizeByAccount } from './account-summary';
import { carriedRows } from './carried-rows';
import { PaymentSummary } from './payment-summary';
import { EmailInvoiceDialog } from './email-invoice-dialog';
import { ShareInvoiceButton } from './whatsapp-share-buttons';
import { PrintReceiptDialog, type PrintMode } from './print-receipt-dialog';
import { useDocumentDeliveries, useLogDocumentPrint } from './use-document-deliveries';
import { DocumentDeliveryLog, deliverySummary } from './document-delivery-log';
import { usePrintMode } from './pos-print';
import { InvoicePos } from './invoice-pos';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
// Raven's collection-account flow (`PaymentAccountsCard`) is disabled — see
// the note above its commented-out usage below.
// import { PaymentAccountsCard } from './payment-accounts-card';
import { Field, Row } from './invoice-detail-page-parts';
import { describeDiscountValue } from './discount-scope';

/** Ships with the app for a school that has not uploaded its own crest yet. */
const DEFAULT_LOGO = '/site/logo.png';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoice = useInvoice(id);
  const { membership, can } = useAuth();
  const deleteInvoices = useDeleteInvoices();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const printInvoice = usePrintMode();

  const canManageInvoice = can('invoice.manage');
  const logPrint = useLogDocumentPrint('INVOICE', id ?? '');
  // Read here as well as inside the log card — one shared query — so the header
  // can say whether the family has this invoice before anybody scrolls.
  const deliveries = useDocumentDeliveries('INVOICE', canManageInvoice ? id : undefined);

  /**
   * Printing also notes the print in the delivery register. Logged before the
   * print dialog opens, because `window.print()` blocks this thread until the
   * person dismisses it, and a request fired afterwards would sit waiting on a
   * dialog somebody may have wandered away from.
   */
  const printAndLog = (mode: PrintMode) => {
    logPrint.mutate({ printFormat: mode === 'pos' ? 'POS' : 'FULL_PAGE', includeCharges: false });
    printInvoice(mode);
  };

  // An invoice always belongs to exactly one student, so the way back is to
  // their record — specifically the Fees tab this was most likely opened
  // from — not the general invoices list, same as `InvoiceFormPage`.
  const breadcrumbs = invoice.data
    ? [
        { label: 'Students', to: '/students' },
        {
          label: invoice.data.studentName,
          to: `/students/${invoice.data.studentId}?tab=finance`,
        },
      ]
    : [{ label: 'Students', to: '/students' }];

  if (invoice.isPending) {
    return (
      <PageContainer width="narrow">
        <PageHeader loading title="" breadcrumbs={breadcrumbs} />
        <LoadingState label="Loading invoice…" />
      </PageContainer>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Invoice" breadcrumbs={breadcrumbs} />
        <ErrorState error={invoice.error} onRetry={() => void invoice.refetch()} />
      </PageContainer>
    );
  }

  const record = invoice.data;
  const currency = 'NGN';

  // The school's own colours, so a printed bill reads as theirs rather than
  // a generic template — `contrastingTextColor` is what keeps text on top of
  // an arbitrary chosen colour readable, whatever the school picked.
  const primary = membership?.branding.primaryColor || '#1d4ed8';
  const accent = membership?.branding.accentColor || primary;
  const onPrimary = contrastingTextColor(primary);
  const logoUrl = record.schoolLogoUrl || membership?.branding.logoUrl || DEFAULT_LOGO;
  const accountSummary = summarizeByAccount(record.lines, (line) => line.lineTotal);
  // `appliedDiscounts` only ever names a ticked discount — a discount keyed
  // straight onto a charge (no name attached) still counts toward
  // `discountTotal` but has no row of its own above; the remainder is shown
  // as one "Charge discounts" line so the summary never falls short of it.
  const unnamedDiscountTotal =
    record.discountTotal - record.appliedDiscounts.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <PageContainer width="narrow">
      <div className="no-print">
        <PageHeader
          title={record.invoiceNo}
          description={`${record.termName} · ${record.sessionName}`}
          breadcrumbs={[...breadcrumbs, { label: record.invoiceNo }]}
          meta={
            <>
              <StatusBadge status={record.status} />
              {/* Has the family actually been told what they owe? Only shown
                  once the register has loaded, so a slow read never reads as
                  "not sent yet". */}
              {canManageInvoice && deliveries.data && (
                <Badge tone={deliverySummary(deliveries.data).tone}>
                  {deliverySummary(deliveries.data).label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Issued {formatDate(record.issueDate)} · due {formatDate(record.dueDate)}
              </span>
            </>
          }
          actions={
            <>
              <Button data-cy="finance-invoice-detail-student-record" variant="outline" asChild>
                <Link to={`/students/${record.studentId}?tab=finance`}>
                  <User />
                  Student record
                </Link>
              </Button>
              {record.balance > 0 && (
                <PermissionGate require="payment.manage">
                  <Button data-cy="finance-invoice-detail-record-a-payment" asChild>
                    <Link to={`/finance/payments/new?studentId=${record.studentId}`}>
                      <CreditCard />
                      Record a payment
                    </Link>
                  </Button>
                </PermissionGate>
              )}
              <Button data-cy="finance-invoice-detail-print" variant="outline" onClick={() => setPrintOpen(true)}>
                <Printer />
                Print
              </Button>
              <PermissionGate require="invoice.manage">
                <Button
                  data-cy="finance-invoice-detail-email"
                  variant="outline"
                  onClick={() => setEmailOpen(true)}
                >
                  <Mail />
                  Email invoice
                </Button>
              </PermissionGate>
              <ShareInvoiceButton
                invoiceId={record.id}
                // The server logs the share; this is what brings the new entry
                // onto the page the sender is still looking at.
                onShared={() => void deliveries.refetch()}
              />
              {record.status !== 'CANCELLED' && (
                <PermissionGate require="invoice.manage">
                  <Button data-cy="finance-invoice-detail-edit" variant="outline" asChild>
                    <Link to={`/finance/invoices/${record.id}/edit`}>
                      <Pencil />
                      Edit
                    </Link>
                  </Button>
                </PermissionGate>
              )}
              <PermissionGate require="invoice.manage">
                {(() => {
                  const deleteButton = (
                    <Button
                      data-cy="finance-invoice-detail-delete"
                      variant="outline"
                      disabled={!record.deletable}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  );
                  return record.deletable ? (
                    deleteButton
                  ) : (
                    <Tooltip content="Refused: this invoice has a payment recorded against it, or carries a balance to or from another invoice.">
                      <span className="inline-flex">{deleteButton}</span>
                    </Tooltip>
                  );
                })()}
              </PermissionGate>
            </>
          }
        />
      </div>

      <Card className="print-page overflow-hidden">
        {/* The school's own colour, top and centre, is what makes this read
            as their letterhead rather than a generic invoice template. */}
        <div style={{ backgroundColor: primary }} className="h-2.5" />

        <CardContent className="space-y-6 pt-6">
          <header
            className="flex flex-wrap items-start justify-between gap-6 border-b-2 pb-5"
            style={{ borderColor: primary }}
          >
            <div className="flex min-w-0 items-start gap-4">
              <img
                src={logoUrl}
                alt=""
                className="size-16 shrink-0 rounded-md object-contain"
              />
              <div className="min-w-0">
                <h2 className="text-xl font-bold" style={{ color: primary }}>
                  {record.schoolName}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{record.schoolAddress}</p>
                <p className="text-sm text-muted-foreground">
                  {record.schoolPhone}
                  {record.schoolEmail ? ` · ${record.schoolEmail}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-2xl font-extrabold uppercase tracking-wide"
                style={{ color: accent }}
              >
                Invoice
              </p>
              <p className="font-mono text-sm text-muted-foreground">{record.invoiceNo}</p>
            </div>
          </header>

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</dt>
              <dd className="font-semibold">{record.studentName}</dd>
              <dd className="text-muted-foreground">
                {record.admissionNo} · {record.className ?? '—'}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 sm:justify-items-end sm:text-right">
              <Field label="Term" value={`${record.termName} · ${record.sessionName}`} />
              <Field label="Issued" value={formatDate(record.issueDate)} />
              <Field label="Due" value={formatDate(record.dueDate)} />
            </div>
          </dl>

          <div className="scrollbar-thin overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Charges on this invoice</caption>
              <thead style={{ backgroundColor: primary, color: onPrimary }}>
                <tr className="text-xs uppercase tracking-wide">
                  <th scope="col" className="px-3 py-2.5 text-left">Description</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Paid</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      {line.description}
                      {line.quantity > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          × {line.quantity} ({formatCurrency(line.unitAmount, currency, { showDecimals: false })} each)
                        </span>
                      )}
                      {line.isOptional && (
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      )}
                      {line.accounts.map((account, index) => (
                        <span key={index} className="block text-xs text-muted-foreground">
                          Pay into {account.label ? `${account.label} — ` : ''}
                          {account.bankName} · {account.accountNumber} · {account.accountName}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {line.discountAmount > 0 ? (
                        <>
                          <span className="block font-normal text-muted-foreground line-through">
                            {formatCurrency(line.unitAmount * line.quantity, currency, {
                              showDecimals: false,
                            })}
                          </span>
                          <span>{formatCurrency(line.lineTotal, currency, { showDecimals: false })}</span>
                          <span className="block text-xs font-normal text-success">
                            − {formatCurrency(line.discountAmount, currency, { showDecimals: false })}{' '}
                            discount
                          </span>
                        </>
                      ) : (
                        formatCurrency(line.lineTotal, currency, { showDecimals: false })
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {line.amountPaid > 0
                        ? formatCurrency(line.amountPaid, currency, { showDecimals: false })
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        line.balance > 0 ? 'text-danger' : 'text-success',
                      )}
                    >
                      {formatCurrency(line.balance, currency, { showDecimals: false })}
                    </td>
                  </tr>
                ))}
                {/* A balance brought forward, itemized rather than one lump, so the
                    family sees which fee items it is still for. */}
                {record.carriedFrom.map((source) => (
                  <Fragment key={source.invoiceId}>
                    <tr className="bg-muted/40">
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Brought forward from {source.invoiceNo}
                      </th>
                    </tr>
                    {carriedRows(source).map((row) => (
                      <tr key={row.key} data-cy="invoice-carried-row">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {row.billed !== null
                            ? formatCurrency(row.billed, currency, { showDecimals: false })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.paid !== null && row.paid > 0
                            ? formatCurrency(row.paid, currency, { showDecimals: false })
                            : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-medium tabular-nums',
                            row.balance > 0 ? 'text-danger' : 'text-success',
                          )}
                        >
                          {formatCurrency(row.balance, currency, { showDecimals: false })}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {record.note && (
              <p
                className="max-w-sm flex-1 whitespace-pre-line rounded-md border-l-4 bg-muted/40 p-3 text-sm font-bold text-foreground"
                style={{ borderColor: accent }}
              >
                {record.note}
              </p>
            )}

            <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <Row
                label="Subtotal"
                value={formatCurrency(record.subtotal, currency, { showDecimals: false })}
              />
              {record.appliedDiscounts.map((discount) => (
                <Row
                  key={discount.discountId}
                  label={discount.name}
                  hint={describeDiscountValue(discount)}
                  value={`− ${formatCurrency(discount.amount, currency, { showDecimals: false })}`}
                />
              ))}
              {/* A discount keyed straight onto a charge (see the table above)
                  carries no name the way a ticked discount does — whatever of
                  `discountTotal` the named rows above don't already account
                  for is shown here, so the summary is never short of the total. */}
              {unnamedDiscountTotal > 0 && (
                <Row
                  label="Charge discounts"
                  value={`− ${formatCurrency(unnamedDiscountTotal, currency, { showDecimals: false })}`}
                />
              )}
              {record.broughtForward > 0 && (
                <Row
                  label="Brought forward"
                  value={formatCurrency(record.broughtForward, currency, { showDecimals: false })}
                  hint="Unpaid from a previous term"
                />
              )}
              <Row
                label="Total"
                value={formatCurrency(record.total, currency, { showDecimals: false })}
                emphasis
              />
              <Row
                label="Paid"
                value={formatCurrency(record.amountPaid, currency, { showDecimals: false })}
              />
              <div
                className="mt-1 rounded-md border-l-4 py-1 pl-3"
                style={{ borderColor: accent }}
              >
                <Row
                  label="Balance due"
                  value={formatCurrency(record.balance, currency, { showDecimals: false })}
                  emphasis
                  tone={record.balance > 0 ? 'danger' : 'success'}
                />
              </div>
            </dl>
          </div>

          {accountSummary.length > 0 && (
            <PaymentSummary rows={accountSummary} currency={currency} accent={accent} />
          )}

          <footer
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground"
          >
            <span>Questions about this bill?</span>
            {record.schoolPhone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" style={{ color: primary }} aria-hidden="true" />
                {record.schoolPhone}
              </span>
            )}
            {record.schoolEmail && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" style={{ color: primary }} aria-hidden="true" />
                {record.schoolEmail}
              </span>
            )}
          </footer>
        </CardContent>
      </Card>

      {/*
        Disabled: Raven's collection-account issuing is not working end to
        end yet. Re-enable by uncommenting this and the import above once it
        is (was: only while something is still owed, and never on the printed
        copy — a paid invoice does not need somewhere to pay, and the account
        number belongs to this bill specifically).
      */}
      {/* {record.balance > 0 && (
        <PermissionGate require="payment.manage">
          <div className="no-print">
            <PaymentAccountsCard
              studentId={record.studentId}
              currency={currency}
              invoiceId={record.id}
              defaultAmount={record.balance}
            />
          </div>
        </PermissionGate>
      )} */}

      <ConfirmDialog
        data-cy="finance-invoice-detail-delete-confirm"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title="Delete this invoice?"
        description={`"${record.invoiceNo}" will be removed entirely, not just cancelled. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteInvoices.isPending}
        onConfirm={async () => {
          const result = await deleteInvoices.mutateAsync([record.id]);
          setDeleteOpen(false);
          if (result.deletedIds.includes(record.id)) navigate('/finance/invoices');
        }}
      />

      {/* Below the invoice, and never on the paper: the office's own record of
          where copies went, not part of the document itself. */}
      {canManageInvoice && (
        <DocumentDeliveryLog
          documentType="INVOICE"
          documentId={record.id}
          studentId={record.studentId}
          sendable={record.status !== 'CANCELLED'}
        />
      )}

      <EmailInvoiceDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoiceId={record.id}
        studentId={record.studentId}
      />

      <PrintReceiptDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        onPrint={printAndLog}
        title="Print invoice"
        storageKey="invoice-print-mode"
        dataCyPrefix="finance-invoice-print"
      />
      <InvoicePos record={record} accountSummary={accountSummary} />
    </PageContainer>
  );
}
