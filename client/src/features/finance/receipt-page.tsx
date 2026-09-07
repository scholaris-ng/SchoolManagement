import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { env } from '@/lib/env';
import { useReceipt } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/data/qr-code';
import { ErrorState, LoadingState } from '@/components/ui/feedback';

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

  if (receipt.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading receipt…" />
      </PageContainer>
    );
  }

  if (receipt.isError || !receipt.data) {
    return (
      <PageContainer>
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      </PageContainer>
    );
  }

  const record = receipt.data;
  const verifyUrl = `${env.appUrl}/verify/${record.verificationCode}`;

  return (
    <PageContainer width="narrow">
      <div className="no-print">
        <PageHeader
          title={`Receipt ${record.receiptNo}`}
          description={`${record.studentName} · ${formatDateTime(record.paidAt)}`}
          breadcrumbs={[
            { label: 'Finance', to: '/finance' },
            { label: 'Payments', to: '/finance/payments' },
            { label: record.receiptNo },
          ]}
          actions={
            <Button onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          }
        />
      </div>

      <Card className="print-page">
        <CardContent className="space-y-5 pt-6">
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
                    <tr key={index}>
                      <td className="py-1.5 font-mono text-xs">{allocation.invoiceNo}</td>
                      <td className="py-1.5">{allocation.description}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatCurrency(allocation.amount, 'NGN', { showDecimals: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Balance after this payment: </span>
                <span
                  className={`font-semibold tabular-nums ${record.balanceAfter > 0 ? 'text-danger' : 'text-success'}`}
                >
                  {formatCurrency(record.balanceAfter, 'NGN')}
                </span>
              </p>
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
