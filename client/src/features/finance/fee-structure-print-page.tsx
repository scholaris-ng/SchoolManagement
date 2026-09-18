import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, Phone, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { contrastingTextColor } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useFeeStructure } from './api';
import { summarizeByAccount } from './account-summary';
import { PaymentSummary } from './payment-summary';
import { ShareFeeScheduleButton } from './whatsapp-share-buttons';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/feedback';

/** Ships with the app for a school that has not uploaded its own crest yet. */
const DEFAULT_LOGO = '/site/logo.png';

/**
 * A fee structure, printed or shared as its own document — no student, no
 * invoice behind it.
 *
 * "Generate invoices" bills whoever is actually enrolled and in scope right
 * now, and reports the rest as skipped; that is correct, not a bug, when the
 * scope covers nobody yet. This is the other thing a bursar reaches for: a
 * plain statement of what a term costs, to hand a prospective family or post
 * where everyone can see it, before a single pupil is billed from it. Same
 * letterhead treatment as `invoice-detail-page.tsx`, so the two read as one
 * family of documents rather than a polished one and a plain one.
 */
export function FeeStructurePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { membership } = useAuth();
  const structure = useFeeStructure(id);
  // Typed fresh for whichever printing this is — there is no invoice behind
  // this document to have saved one on, unlike `generate-invoices-dialog.tsx`.
  const [note, setNote] = useState('');

  const breadcrumbs = [
    { label: 'Finance', to: '/finance' },
    { label: 'Fees', to: '/finance/fees' },
  ];

  if (structure.isPending) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader loading title="" breadcrumbs={breadcrumbs} />
        </div>
        <LoadingState label="Loading fee structure…" />
      </PageContainer>
    );
  }

  if (structure.isError || !structure.data) {
    return (
      <PageContainer width="narrow">
        <div className="no-print">
          <PageHeader title="Fee schedule" breadcrumbs={breadcrumbs} />
        </div>
        <ErrorState error={structure.error} onRetry={() => void structure.refetch()} />
      </PageContainer>
    );
  }

  const record = structure.data;
  const currency = 'NGN';
  // Only worth a section of its own once there is more than one account to
  // add up — with a single account the totals just above already answer it.
  const accountSummary = summarizeByAccount(record.lines, (line) => line.amount);
  const scopeLine = [
    `${record.sessionName} Session`,
    record.termName ?? 'Every term',
    record.levelNames.length > 0 ? record.levelNames.join(', ') : 'All levels',
  ].join(' · ');

  const primary = membership?.branding.primaryColor || '#1d4ed8';
  const accent = membership?.branding.accentColor || primary;
  const onPrimary = contrastingTextColor(primary);
  const logoUrl = record.schoolLogoUrl || membership?.branding.logoUrl || DEFAULT_LOGO;

  return (
    <PageContainer width="narrow">
      <div className="no-print">
        <PageHeader
          title={record.name}
          description={scopeLine}
          breadcrumbs={[...breadcrumbs, { label: record.name }]}
          actions={
            <>
              <ShareFeeScheduleButton structureId={record.id} note={note} />
              <Button data-cy="finance-structure-print" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            </>
          }
        />
      </div>

      <div className="no-print space-y-1.5">
        <Label htmlFor="schedule-note">Note to print</Label>
        <Textarea
          data-cy="finance-structure-print-note"
          id="schedule-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Please note that all payments should be made by the 3rd week."
        />
        <p className="text-xs text-muted-foreground">
          Shown in bold on this document. Typed fresh each time you print — nothing is saved.
        </p>
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
                  {record.schoolName ?? membership?.schoolName}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{scopeLine}</p>
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-2xl font-extrabold uppercase tracking-wide"
                style={{ color: accent }}
              >
                Fee schedule
              </p>
              <p className="text-sm text-muted-foreground">{record.name}</p>
            </div>
          </header>

          <div className="scrollbar-thin overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Charges in this fee structure</caption>
              <thead style={{ backgroundColor: primary, color: onPrimary }}>
                <tr className="text-xs uppercase tracking-wide">
                  <th scope="col" className="px-3 py-2.5 text-left">Charge</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      {line.feeItemName}
                      {line.isOptional && (
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      )}
                      {line.accounts.map((account) => (
                        <span key={account.id} className="block text-xs text-muted-foreground">
                          Pay into {account.label ? `${account.label} — ` : ''}
                          {account.bankName} · {account.accountNumber} · {account.accountName}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(line.amount, currency, { showDecimals: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {note.trim() && (
              <p
                className="max-w-sm flex-1 whitespace-pre-line rounded-md border-l-4 bg-muted/40 p-3 text-sm font-bold text-foreground"
                style={{ borderColor: accent }}
              >
                {note}
              </p>
            )}

            <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Every pupil in scope</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(record.mandatoryTotal, currency, { showDecimals: false })}
                </span>
              </div>
              {record.optionalTotal > 0 && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Optional, on top</span>
                  <span className="tabular-nums">
                    + {formatCurrency(record.optionalTotal, currency, { showDecimals: false })}
                  </span>
                </div>
              )}
            </dl>
          </div>

          {accountSummary.length > 1 && (
            <PaymentSummary rows={accountSummary} currency={currency} accent={accent} />
          )}

          {!record.isActive && (
            <Badge tone="warning">This structure is not currently active</Badge>
          )}

          {(record.schoolPhone || record.schoolEmail) && (
            <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Questions about this schedule?</span>
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
