import { Link, useParams } from 'react-router-dom';
import { CreditCard, Mail, MessageCircle, Phone, Printer, User } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { contrastingTextColor } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { useAuth } from '@/app/providers/auth-provider';
import { useInvoice } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
// Raven's collection-account flow (`PaymentAccountsCard`) is disabled — see
// the note above its commented-out usage below.
// import { PaymentAccountsCard } from './payment-accounts-card';
import { Field, Row } from './invoice-detail-page-parts';

/** Ships with the app for a school that has not uploaded its own crest yet. */
const DEFAULT_LOGO = '/site/logo.png';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useInvoice(id);
  const { membership } = useAuth();

  const breadcrumbs = [
    { label: 'Finance', to: '/finance' },
    { label: 'Invoices', to: '/finance/invoices' },
  ];

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
              <span className="text-xs text-muted-foreground">
                Issued {formatDate(record.issueDate)} · due {formatDate(record.dueDate)}
              </span>
            </>
          }
          actions={
            <>
              <Button data-cy="finance-invoice-detail-student-record" variant="outline" asChild>
                <Link to={`/students/${record.studentId}`}>
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
              <Button data-cy="finance-invoice-detail-print" variant="outline" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
              <Button
                data-cy="finance-invoice-detail-whatsapp"
                variant="outline"
                onClick={() =>
                  toast.info('Coming soon', {
                    description: "Sending invoices straight to a guardian's WhatsApp is on the way.",
                  })
                }
              >
                <MessageCircle />
                Send to WhatsApp
              </Button>
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
                  <th scope="col" className="px-3 py-2.5 text-right">Qty</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Unit</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Discount</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      {line.description}
                      {line.isOptional && (
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      )}
                      {line.bankName && line.accountNumber && (
                        <span className="block text-xs text-muted-foreground">
                          Pay into {line.bankName} · {line.accountNumber}
                          {line.accountName ? ` · ${line.accountName}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(line.unitAmount, currency, { showDecimals: false })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.discountAmount > 0
                        ? `− ${formatCurrency(line.discountAmount, currency, { showDecimals: false })}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(line.lineTotal, currency, { showDecimals: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {record.note && (
              <p
                className="max-w-sm flex-1 rounded-md border-l-4 bg-muted/40 p-3 text-sm font-bold text-foreground"
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
              {record.discountTotal > 0 && (
                <Row
                  label="Discounts"
                  value={`− ${formatCurrency(record.discountTotal, currency, { showDecimals: false })}`}
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
    </PageContainer>
  );
}
