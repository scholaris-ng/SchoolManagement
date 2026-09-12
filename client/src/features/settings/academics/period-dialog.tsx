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
import { useSavePeriod } from '@/features/academics/api';
import type { TimetablePeriod } from '@/types/curriculum';

export function PeriodDialog({
  state,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; period?: TimetablePeriod };
  nextSequence: number;
  onClose: () => void;
}) {
  const save = useSavePeriod();
  const [name, setName] = useState(state.period?.name ?? '');
  const [startTime, setStartTime] = useState(state.period?.startTime ?? '');
  const [endTime, setEndTime] = useState(state.period?.endTime ?? '');
  const [sequence, setSequence] = useState(String(state.period?.sequence ?? nextSequence));
  const [isBreak, setIsBreak] = useState(state.period?.isBreak ?? false);

  const valid = Boolean(name.trim() && startTime && endTime);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.period ? 'Edit period' : 'New period'}</DialogTitle>
          <DialogDescription>
            Set when this period runs and where it falls in the school day.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="period-name" required>
              Name
            </Label>
            <Input
              data-cy="period-name"
              id="period-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Period 1, or Break"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-start" required>
                Starts
              </Label>
              <Input
                data-cy="period-start"
                id="period-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end" required>
                Ends
              </Label>
              <Input
                data-cy="period-end"
                id="period-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-sequence" required>
              Sequence
            </Label>
            <Input
              data-cy="period-sequence"
              id="period-sequence"
              type="number"
              min={1}
              value={sequence}
              onChange={(event) => setSequence(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where this period sits in the school day, top to bottom on the timetable — 1 comes
              before 2, and so on.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              data-cy="academics-settings-is-break"
              type="checkbox"
              checked={isBreak}
              onChange={(event) => setIsBreak(event.target.checked)}
              className="size-4 rounded border-input"
            />
            This is a break, not a teaching period
          </label>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-3" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-3"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.period?.id,
                  values: {
                    name: name.trim(),
                    startTime,
                    endTime,
                    sequence: Number(sequence),
                    isBreak,
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
