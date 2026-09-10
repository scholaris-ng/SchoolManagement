import { useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { teachingWeeksBetween } from '@/lib/weekdays';
import { useSaveTerm } from '@/features/academics/api';
import type { Term } from '@/types/academics';

export function TermDialog({
  state,
  onClose,
}: {
  state: { open: boolean; term?: Term; sessionId?: string; sessionName?: string };
  onClose: () => void;
}) {
  const save = useSaveTerm();
  const [name, setName] = useState(state.term?.name ?? '');
  const [startDate, setStartDate] = useState(state.term?.startDate ?? '');
  const [endDate, setEndDate] = useState(state.term?.endDate ?? '');

  // Read off the dates rather than typed in: a term whose dates move and whose
  // week count does not is how a scheme of work ends up planned against weeks
  // the term does not have.
  const teachingWeeks = teachingWeeksBetween(startDate, endDate);
  const datesOutOfOrder = Boolean(startDate && endDate && endDate < startDate);

  const valid = Boolean(name.trim() && startDate && endDate && !datesOutOfOrder);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.term ? 'Edit term' : 'New term'}</DialogTitle>
          <DialogDescription>{state.term?.sessionName ?? state.sessionName}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="term-name" required>
              Name
            </Label>
            <Input
              data-cy="term-name"
              id="term-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. First Term"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="term-start" required>
                Starts
              </Label>
              <Input
                data-cy="term-start"
                id="term-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-end" required>
                Ends
              </Label>
              <Input
                data-cy="term-end"
                id="term-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-weeks">Teaching weeks</Label>
            <Input data-cy="term-weeks" id="term-weeks" value={teachingWeeks || '—'} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              {datesOutOfOrder
                ? 'The end date is before the start date.'
                : teachingWeeks
                  ? 'Counted from the dates above, Mondays to Fridays. Schemes of work are spread across these weeks.'
                  : 'Set the start and end dates and this is worked out for you.'}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-2" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-2"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.term?.id,
                  values: {
                    name: name.trim(),
                    startDate,
                    endDate,
                    teachingWeeks,
                    ...(state.term ? {} : { sessionId: state.sessionId }),
                  },
                })
                .then(onClose)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
