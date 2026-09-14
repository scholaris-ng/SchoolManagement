import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, MessageCircle, Phone, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/lib/toast-bus';
import { useAuth } from '@/app/providers/auth-provider';
import { useFeeStructure } from './api';
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
 * where everyone can see it, before a single pupil is billed from it.
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
  const scopeLine = [
    `${record.sessionName} Session`,
    record.termName ?? 'Every term',
    record.levelNames.length > 0 ? record.levelNames.join(', ') : 'All levels',
  ].join(' · ');

  return (
    <PageContainer width="narrow">
      <div className="no-print">
        <PageHeader
          title={record.name}
          description={scopeLine}
          breadcrumbs={[...breadcrumbs, { label: record.name }]}
          actions={
            <>
              <Button
                data-cy="finance-structure-print-whatsapp"
                variant="outline"
                onClick={() =>
                  toast.info('Coming soon', {
                    description: 'Sending a fee schedule straight to WhatsApp is on the way.',
                  })
                }
              >
                <MessageCircle />
                Send to WhatsApp
              </Button>
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

      <Card className="print-page">
        <CardContent className="space-y-5 pt-6">
          <header className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
            <img
              src={record.schoolLogoUrl || membership?.branding.logoUrl || DEFAULT_LOGO}
              alt=""
              className="size-14 object-contain"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{record.schoolName ?? membership?.schoolName}</h2>
              <p className="text-sm text-muted-foreground">Fee schedule</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Structure</p>
              <p className="font-semibold">{record.name}</p>
            </div>
          </header>

          <p className="text-sm text-muted-foreground">{scopeLine}</p>

          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Charges in this fee structure</caption>
              <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left">Charge</th>
                  <th scope="col" className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-2 py-2">
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
                    <td className="px-2 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(line.amount, currency, { showDecimals: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 border-t border-border pt-3 text-sm">
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
          </div>

          {note.trim() && (
            <p className="whitespace-pre-line border-t border-border pt-3 text-sm font-bold text-foreground">
              {note}
            </p>
          )}

          {!record.isActive && (
            <Badge tone="warning">This structure is not currently active</Badge>
          )}

          {(record.schoolPhone || record.schoolEmail) && (
            <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Questions about this schedule?</span>
              {record.schoolPhone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" aria-hidden="true" />
                  {record.schoolPhone}
                </span>
              )}
              {record.schoolEmail && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden="true" />
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
