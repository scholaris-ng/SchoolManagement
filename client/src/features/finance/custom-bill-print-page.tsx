import { useParams } from 'react-router-dom';
import { Landmark, Mail, MessageCircle, Phone, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { contrastingTextColor } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { useAuth } from '@/app/providers/auth-provider';
import { useCustomBill } from './use-custom-bills';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/feedback';

/** Ships with the app for a school that has not uploaded its own crest yet. */
const DEFAULT_LOGO = '/site/logo.png';

/**
 * A one-off bill, printed or shared like any other invoice — see `CustomBill`
 * for why it has no student, balance, or ledger entry behind it.
 */
export function CustomBillPrintPage() {
  const { id } = useParams<{ id: string }>();
  const bill = useCustomBill(id);
  const { membership } = useAuth();

  const breadcrumbs = [
    { label: 'Finance', to: '/finance' },
    { label: 'Custom bills', to: '/finance/custom-bills' },
  ];

  if (bill.isPending) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader loading title="" breadcrumbs={breadcrumbs} />
        </div>
        <LoadingState label="Loading bill…" />
      </PageContainer>
    );
  }

  if (bill.isError || !bill.data) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader title="Bill" breadcrumbs={breadcrumbs} />
        </div>
        <ErrorState error={bill.error} onRetry={() => void bill.refetch()} />
      </PageContainer>
    );
  }

  const record = bill.data;
  const currency = 'NGN';

  const primary = membership?.branding.primaryColor || '#1d4ed8';
  const accent = membership?.branding.accentColor || primary;
  const onPrimary = contrastingTextColor(primary);
  const logoUrl = record.schoolLogoUrl || membership?.branding.logoUrl || DEFAULT_LOGO;

  return (
    <PageContainer width="narrow">
      <div className="no-print">
        <PageHeader
          title={record.payerName}
          description={formatDate(record.createdAt)}
          breadcrumbs={[...breadcrumbs, { label: record.payerName }]}
          actions={
            <>
              <Button
                data-cy="custom-bill-print-whatsapp"
                variant="outline"
                onClick={() =>
                  toast.info('Coming soon', {
                    description: 'Sending a bill straight to WhatsApp is on the way.',
                  })
                }
              >
                <MessageCircle />
                Send to WhatsApp
              </Button>
              <Button data-cy="custom-bill-print-action" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            </>
          }
        />
      </div>

      <Card className="print-page overflow-hidden">
        <div style={{ backgroundColor: primary }} className="h-2.5" />

        <CardContent className="space-y-6 pt-6">
          <header
            className="flex flex-wrap items-start justify-between gap-6 border-b-2 pb-5"
            style={{ borderColor: primary }}
          >
            <div className="flex min-w-0 items-start gap-4">
              <img src={logoUrl} alt="" className="size-16 shrink-0 rounded-md object-contain" />
              <div className="min-w-0">
                <h2 className="text-xl font-bold" style={{ color: primary }}>
                  {record.schoolName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {record.schoolPhone}
                  {record.schoolEmail ? ` · ${record.schoolEmail}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold uppercase tracking-wide" style={{ color: accent }}>
                Bill
              </p>
              <p className="text-sm text-muted-foreground">{formatDate(record.createdAt)}</p>
            </div>
          </header>

          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</dt>
            <dd className="text-lg font-semibold">{record.payerName}</dd>
          </div>

          <div className="scrollbar-thin overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Charges on this bill</caption>
              <thead style={{ backgroundColor: primary, color: onPrimary }}>
                <tr className="text-xs uppercase tracking-wide">
                  <th scope="col" className="px-3 py-2.5 text-left">Description</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">{line.description}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(line.amount, currency, { showDecimals: false })}
                    </td>
                  </tr>
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
            <div className="ml-auto rounded-md border-l-4 py-1 pl-3" style={{ borderColor: accent }}>
              <div className="flex items-baseline justify-between gap-6 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCurrency(record.total, currency, { showDecimals: false })}
                </span>
              </div>
            </div>
          </div>

          {record.accounts.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
                Payment accounts
              </p>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                Pay the total above into any one of the following.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {record.accounts.map((account, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <span
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      <Landmark className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{account.label || account.bankName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.label ? `${account.bankName} · ` : ''}
                        {account.accountNumber} · {account.accountName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(record.schoolPhone || record.schoolEmail) && (
            <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
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
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
