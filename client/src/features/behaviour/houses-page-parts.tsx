import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { useStudentSearch } from '@/features/students/api';
import { useAwardHousePoints } from './api';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { REASONS } from './houses-page-constants';

/**
 * Pieces used by `houses-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function AwardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const award = useAwardHousePoints();
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const results = useStudentSearch(query, { enabled: query.length >= 2 });

  const [points, setPoints] = useState('5');
  const [reason, setReason] = useState('ACADEMIC');
  const [note, setNote] = useState('');

  const valid = Boolean(student) && Number(points) !== 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Award house points</DialogTitle>
          <DialogDescription>
            Points count for the student and their house together. Use a negative number to deduct.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="award-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button data-cy="behaviour-houses-change" variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  data-cy="behaviour-houses-query"
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search by name or admission number…"
                />
                {results.data && results.data.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {results.data.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          data-cy={`houses-student-result-${match.id}`}
                          onClick={() => setStudent({ id: match.id, name: match.fullName })}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {match.fullName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {match.admissionNo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="award-points" required>
                Points
              </Label>
              <Input
                data-cy="award-points"
                id="award-points"
                type="number"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="award-reason">Reason</Label>
              <NativeSelect
                data-cy="award-reason"
                id="award-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {REASONS.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="award-note">Note</Label>
            <Textarea
              data-cy="award-note"
              id="award-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What earned this?"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="behaviour-houses-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="behaviour-houses-award"
            loading={award.isPending}
            disabled={!valid}
            onClick={() =>
              student &&
              void award
                .mutateAsync({
                  studentId: student.id,
                  points: Number(points),
                  reason,
                  note: note.trim() || undefined,
                })
                .then(() => {
                  onOpenChange(false);
                  setStudent(null);
                  setNote('');
                })
            }
          >
            Award
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
