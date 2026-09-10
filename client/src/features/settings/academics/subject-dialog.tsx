import { WEEKDAYS } from '@/lib/weekdays';
import type { SchoolLevel } from '@/types/academics';
import type { TimetablePeriod, Weekday } from '@/types/curriculum';
import { useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useSaveSubject } from '@/features/academics/api';
import type { Subject } from '@/types/academics';

export function SubjectDialog({
  state,
  levels,
  periods,
  onClose,
}: {
  state: { open: boolean; subject?: Subject };
  levels: SchoolLevel[];
  periods: TimetablePeriod[];
  onClose: () => void;
}) {
  const save = useSaveSubject();
  const [name, setName] = useState(state.subject?.name ?? '');
  const [code, setCode] = useState(state.subject?.code ?? '');
  const [category, setCategory] = useState(state.subject?.category ?? '');
  const [isCore, setIsCore] = useState(state.subject?.isCore ?? true);
  const [levelIds, setLevelIds] = useState<string[]>(state.subject?.levelIds ?? []);
  const [schedule, setSchedule] = useState<Set<string>>(
    () => new Set((state.subject?.schedule ?? []).map((slot) => `${slot.day}:${slot.periodId}`)),
  );

  const toggleSlot = (day: Weekday, periodId: string) => {
    const key = `${day}:${periodId}`;
    setSchedule((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const teachingPeriods = periods.filter((period) => !period.isBreak);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{state.subject ? 'Edit subject' : 'New subject'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="subject-name" required>
                Name
              </Label>
              <Input
                data-cy="subject-name"
                id="subject-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-code" required>
                Code
              </Label>
              <Input
                data-cy="subject-code"
                id="subject-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-category">Category</Label>
              <Input
                data-cy="subject-category"
                id="subject-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Sciences"
              />
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Taught at</legend>
            <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
              {levels.map((level) => (
                <label key={level.id} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="academics-settings-id"
                    type="checkbox"
                    checked={levelIds.includes(level.id)}
                    onChange={() =>
                      setLevelIds((current) =>
                        current.includes(level.id)
                          ? current.filter((entry) => entry !== level.id)
                          : [...current, level.id],
                      )
                    }
                    className="size-4 rounded border-input"
                  />
                  {level.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              data-cy="academics-settings-is-core"
              type="checkbox"
              checked={isCore}
              onChange={(event) => setIsCore(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Core subject — every student at these levels takes it
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Weekly periods</legend>
            <p className="text-xs text-muted-foreground">
              Optional — mark which periods this subject is normally taught in.
            </p>
            {teachingPeriods.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No periods are set up yet — add them under the Periods tab first.
              </p>
            ) : (
              <div className="scrollbar-thin max-h-56 overflow-auto rounded-md border border-input">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="sticky left-0 bg-muted/40 px-2 py-1.5 text-left font-medium">
                        Period
                      </th>
                      {WEEKDAYS.map((day) => (
                        <th key={day.value} className="px-2 py-1.5 text-center font-medium">
                          {day.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teachingPeriods.map((period) => (
                      <tr key={period.id}>
                        <td className="sticky left-0 bg-card px-2 py-1.5 font-medium">
                          {period.name}
                        </td>
                        {WEEKDAYS.map((day) => (
                          <td key={day.value} className="px-2 py-1.5 text-center">
                            <input
                              data-cy="academics-settings-id-2"
                              type="checkbox"
                              aria-label={`${period.name} on ${day.label}`}
                              checked={schedule.has(`${day.value}:${period.id}`)}
                              onChange={() => toggleSlot(day.value, period.id)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-6" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-6"
            loading={save.isPending}
            disabled={!name.trim() || !code.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.subject?.id,
                  values: {
                    name: name.trim(),
                    code: code.trim(),
                    category: category.trim() || null,
                    isCore,
                    levelIds,
                    schedule: Array.from(schedule).map((key) => {
                      const [day, periodId] = key.split(':') as [Weekday, string];
                      return { day, periodId };
                    }),
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
