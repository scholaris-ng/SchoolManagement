import { Link, useParams } from 'react-router-dom';
import { CreditCard, MessageCircle, Printer, User } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/lib/toast-bus';
import { useInvoice } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
// Raven's collection-account flow (`PaymentAccountsCard`) is disabled — see
// the note above its commented-out usage below.
// import { PaymentAccountsCard } from './payment-accounts-card';
import { Field, Row } from './invoice-detail-page-parts';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useInvoice(id);

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

      <Card className="print-page">
        <CardHeader>
          <CardTitle>Invoice {record.invoiceNo}</CardTitle>
          <dl className="grid gap-x-6 gap-y-1 pt-2 text-sm sm:grid-cols-2">
            <Field label="Student" value={record.studentName} />
            <Field label="Admission number" value={record.admissionNo} />
            <Field label="Class" value={record.className ?? '—'} />
            <Field label="Term" value={`${record.termName} · ${record.sessionName}`} />
            <Field label="Issued" value={formatDate(record.issueDate)} />
            <Field label="Due" value={formatDate(record.dueDate)} />
          </dl>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Charges on this invoice</caption>
              <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left">Description</th>
                  <th scope="col" className="px-2 py-2 text-right">Qty</th>
                  <th scope="col" className="px-2 py-2 text-right">Unit</th>
                  <th scope="col" className="px-2 py-2 text-right">Discount</th>
                  <th scope="col" className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-2 py-2">
                      {line.description}
                      {line.isOptional && (
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatCurrency(line.unitAmount, currency, { showDecimals: false })}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {line.discountAmount > 0
                        ? `− ${formatCurrency(line.discountAmount, currency, { showDecimals: false })}`
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(line.lineTotal, currency, { showDecimals: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
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
            <Row
              label="Balance"
              value={formatCurrency(record.balance, currency, { showDecimals: false })}
              emphasis
              tone={record.balance > 0 ? 'danger' : 'success'}
            />
          </dl>

          {record.note && (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              {record.note}
            </p>
          )}
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
