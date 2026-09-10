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
import { useSaveSession } from '@/features/academics/api';
import type { AcademicSession } from '@/types/academics';

export interface TermRow {
  name: string;
  startDate: string;
  endDate: string;
}

export function SessionDialog({
  state,
  onClose,
}: {
  state: { open: boolean; session?: AcademicSession };
  onClose: () => void;
}) {
  const save = useSaveSession();
  const isNew = !state.session;
  const [name, setName] = useState(state.session?.name ?? '');
  const [startDate, setStartDate] = useState(state.session?.startDate ?? '');
  const [endDate, setEndDate] = useState(state.session?.endDate ?? '');
  const [termRows, setTermRows] = useState<TermRow[]>(
    isNew
      ? [
          { name: 'First Term', startDate: '', endDate: '' },
          { name: 'Second Term', startDate: '', endDate: '' },
          { name: 'Third Term', startDate: '', endDate: '' },
        ]
      : [],
  );

  const updateTerm = (index: number, patch: Partial<TermRow>) => {
    setTermRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  // A backwards range would derive no teaching weeks at all, so it is caught
  // here rather than saved and puzzled over later.
  const termsValid = termRows.every(
    (row) => row.name.trim() && row.startDate && row.endDate && row.endDate >= row.startDate,
  );
  const valid =
    Boolean(name.trim() && startDate && endDate) && endDate >= startDate && termsValid;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New academic session' : 'Edit academic session'}</DialogTitle>
          {isNew && (
            <DialogDescription>
              Every session here runs on three terms. Set the session&apos;s own dates, then each
              term&apos;s — nothing is guessed for you, but every date can be changed later.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-name" required>
                Name
              </Label>
              <Input
                data-cy="session-name"
                id="session-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. 2027/2028"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-start" required>
                Starts
              </Label>
              <Input
                data-cy="session-start"
                id="session-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-end" required>
                Ends
              </Label>
              <Input
                data-cy="session-end"
                id="session-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          {isNew && (
            <div className="space-y-3">
              <Label>Terms</Label>
              {termRows.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-name-${index}`} required>
                      Name
                    </Label>
                    <Input
                      data-cy="academics-settings-name"
                      id={`term-name-${index}`}
                      value={row.name}
                      onChange={(event) => updateTerm(index, { name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-start-${index}`} required>
                      Starts
                    </Label>
                    <Input
                      data-cy="academics-settings-start-date"
                      id={`term-start-${index}`}
                      type="date"
                      value={row.startDate}
                      onChange={(event) => updateTerm(index, { startDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-end-${index}`} required>
                      Ends
                    </Label>
                    <Input
                      data-cy="academics-settings-end-date"
                      id={`term-end-${index}`}
                      type="date"
                      min={row.startDate}
                      value={row.endDate}
                      onChange={(event) => updateTerm(index, { endDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-weeks-${index}`}>Teaching weeks</Label>
                    <Input
                      data-cy="academics-settings-end-date-2"
                      id={`term-weeks-${index}`}
                      value={teachingWeeksBetween(row.startDate, row.endDate) || '—'}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.session?.id,
                  values: {
                    name: name.trim(),
                    startDate,
                    endDate,
                    ...(isNew
                      ? {
                          terms: termRows.map((row) => ({
                            name: row.name.trim(),
                            startDate: row.startDate,
                            endDate: row.endDate,
                            teachingWeeks: teachingWeeksBetween(row.startDate, row.endDate),
                          })),
                        }
                      : {}),
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
