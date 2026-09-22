import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import type { PlatformSchool, SmsCreditEntry } from '@/types/platform';
import { Badge, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSchoolSmsCredits } from './use-platform-schools';

/** A billion naira — the server's own ceiling, which is what enforces it. */
const MAX_TOPUP_NGN = 1_000_000_000;

/** The amounts most often paid. */
const QUICK_PICKS = [1000, 2000, 5000, 10_000];

const naira = (amount: number) => formatCurrency(amount, 'NGN', { showDecimals: false });

const ENTRY_LABELS: Record<SmsCreditEntry['type'], { label: string; tone: 'success' | 'neutral' | 'info' | 'warning' }> = {
  TOPUP: { label: 'Top-up', tone: 'success' },
  DEBIT: { label: 'Sent', tone: 'neutral' },
  REFUND: { label: 'Refund', tone: 'info' },
  ADJUSTMENT: { label: 'Adjustment', tone: 'warning' },
};

/**
 * Adds prepaid SMS credit to one school, and shows where its credit has gone.
 *
 * Credit is counted in message pages — one page is one plain 160-character
 * SMS — because that is what the gateway bills, so what the platform was paid
 * for and what the school uses up are the same unit. What a unit costs the
 * school is the platform's business, recorded in the note.
 */
export function SmsCreditsDialog({
  school,
  loading,
  onOpenChange,
  onConfirm,
}: {
  /** The school being topped up, or `null` when the dialog is closed. */
  school: PlatformSchool | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amountNgn: number, note: string) => void | Promise<void>;
}) {
  const [text, setText] = useState('5000');
  const [note, setNote] = useState('');
  const credits = useSchoolSmsCredits(school?.id ?? null);

  // Reopened for another school, the form starts afresh.
  useEffect(() => {
    if (school) {
      setText('5000');
      setNote('');
    }
  }, [school]);

  const amount = Number(text);
  const price = credits.data?.unitPriceNgn ?? null;
  // Rounded down, the same way the server does it — a fraction of a page is never given.
  const units = price ? Math.floor(amount / price) : 0;
  const valid =
    text.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= MAX_TOPUP_NGN && (price === null || units >= 1);
  const balance = credits.data?.balance ?? school?.smsCredits ?? 0;

  return (
    <Dialog open={school !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md" data-cy="platform-sms-credits-dialog">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !loading) void onConfirm(amount, note.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{school ? `SMS credit — ${school.name}` : 'SMS credit'}</DialogTitle>
            <DialogDescription>
              They have{' '}
              <span className={cn('font-semibold', balance === 0 ? 'text-danger' : 'text-foreground')}>
                {formatNumber(balance)} SMS
              </span>
              {price !== null && <> ({naira(balance * price)} worth)</>} left.
              {price !== null && <> Each SMS is {naira(price)}; a birthday greeting is one SMS.</>}
            </DialogDescription>
            <p className="text-xs text-muted-foreground">
              Recipients with Do-Not-Disturb (DND) active on their line won't receive these texts
              until they send <span className="font-mono font-medium text-foreground">STATUS</span>{' '}
              to <span className="font-mono font-medium text-foreground">2442</span> to switch it off.
            </p>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="sms-credit-amount">Amount paid (₦)</Label>
              <Input
                id="sms-credit-amount"
                data-cy="platform-sms-credits-amount"
                type="number"
                inputMode="decimal"
                min={1}
                max={MAX_TOPUP_NGN}
                step="any"
                value={text}
                invalid={!valid}
                onChange={(event) => setText(event.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Common amounts">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    data-cy={`platform-sms-credits-pick-${pick}`}
                    aria-pressed={valid && amount === pick}
                    onClick={() => setText(String(pick))}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      valid && amount === pick
                        ? 'border-primary bg-primary-subtle text-primary dark:text-white'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    {naira(pick)}
                  </button>
                ))}
              </div>
              <p
                className={cn('text-sm', valid ? 'text-muted-foreground' : 'text-danger')}
                aria-live="polite"
                data-cy="platform-sms-credits-summary"
              >
                {!valid
                  ? price !== null && amount > 0 && units < 1
                    ? `${naira(amount)} does not buy a single SMS at ${naira(price)} each.`
                    : 'Enter the amount paid, in naira.'
                  : price === null
                    ? 'Converted to SMS at the platform price once you confirm.'
                    : `${naira(amount)} buys ${formatNumber(units)} SMS at ${naira(price)} each. Balance will then be ${formatNumber(balance + units)} SMS.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sms-credit-note">Note</Label>
              <Textarea
                id="sms-credit-note"
                data-cy="platform-sms-credits-note"
                rows={2}
                maxLength={500}
                placeholder="e.g. Bank transfer, ref 0012345, 22 Sep"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Kept against this top-up, for whoever reconciles it later.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Recent movements</p>
              {credits.isPending ? (
                <LoadingState label="Loading credit history…" />
              ) : credits.isError ? (
                <ErrorState error={credits.error} onRetry={() => void credits.refetch()} />
              ) : credits.data && credits.data.entries.length > 0 ? (
                <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
                  {credits.data.entries.map((entry) => {
                    const meta = ENTRY_LABELS[entry.type];
                    return (
                      <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {entry.amountNgn !== null && (
                              <>
                                {naira(entry.amountNgn)}
                                {entry.unitPriceNgn !== null && <> at {naira(entry.unitPriceNgn)}/SMS</>}
                                {(entry.note || entry.actorName) && ' · '}
                              </>
                            )}
                            {entry.note ?? entry.actorName ?? ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('font-medium tabular-nums', entry.units > 0 ? 'text-success' : 'text-foreground')}>
                            {entry.units > 0 ? '+' : ''}
                            {formatNumber(entry.units)}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">{formatNumber(entry.balanceAfter)} left</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No credit has been added or used yet.</p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" data-cy="platform-sms-credits-confirm" disabled={!valid} loading={loading}>
              {valid && price !== null ? `Add ${formatNumber(units)} SMS for ${naira(amount)}` : 'Add credit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
