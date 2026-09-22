import { useEffect, useState } from 'react';
import { addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { PlatformSchool } from '@/types/platform';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Ten years — the server's own limit (`MAX_ACTIVATION_MONTHS`), which is what actually enforces it. */
export const MAX_ACTIVATION_MONTHS = 120;

/** The lengths most often wanted: a month, a term, half a year, a year. */
const QUICK_PICKS = [1, 3, 6, 12];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Asks how many months to give a school, and says what that comes to.
 *
 * The date shown is worked out here so the choice can be checked before it is
 * made; the server does the same sum again and its answer is the one that
 * stands — the toast afterwards reports it.
 */
export function ActivateSchoolDialog({
  school,
  loading,
  onOpenChange,
  onConfirm,
}: {
  /** The school being activated, or `null` when the dialog is closed. */
  school: PlatformSchool | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (months: number) => void | Promise<void>;
}) {
  const [text, setText] = useState('1');

  // A dialog reopened for another school starts from one month again, not from
  // whatever was typed for the last.
  useEffect(() => {
    if (school) setText('1');
  }, [school]);

  const months = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(months) && months >= 1 && months <= MAX_ACTIVATION_MONTHS;

  // Months count from the later of today and the current end date — the same
  // rule the server applies, so a school with days left keeps them.
  const from = school && !school.expired ? new Date(school.endsAt) : new Date();
  const until = valid ? addMonths(from, months) : null;

  return (
    <Dialog open={school !== null} onOpenChange={onOpenChange}>
      <DialogContent size="sm" data-cy="platform-activate-dialog">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !loading) void onConfirm(months);
          }}
        >
          <DialogHeader>
            <DialogTitle>{school ? `Activate ${school.name}` : 'Activate school'}</DialogTitle>
            <DialogDescription>
              {school?.expired
                ? 'Their access is switched off right now. The months you choose count from today.'
                : school
                  ? `They have ${plural(school.daysLeft, 'day')} left. The months you choose are added after those.`
                  : ''}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="activate-months">Number of months</Label>
              <Input
                id="activate-months"
                data-cy="platform-activate-months"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_ACTIVATION_MONTHS}
                step={1}
                value={text}
                invalid={!valid}
                onChange={(event) => setText(event.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Common lengths">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    data-cy={`platform-activate-pick-${pick}`}
                    aria-pressed={valid && months === pick}
                    onClick={() => setText(String(pick))}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      valid && months === pick
                        ? 'border-primary bg-primary-subtle text-primary dark:text-white'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    {plural(pick, 'month')}
                  </button>
                ))}
              </div>
            </div>

            <p
              className={cn('text-sm', valid ? 'text-muted-foreground' : 'text-danger')}
              aria-live="polite"
              data-cy="platform-activate-summary"
            >
              {until
                ? `Access will then run until ${formatDate(until)}.`
                : `Enter a whole number of months, from 1 to ${MAX_ACTIVATION_MONTHS}.`}
            </p>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" data-cy="platform-activate-confirm" disabled={!valid} loading={loading}>
              {valid ? `Activate for ${plural(months, 'month')}` : 'Activate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
