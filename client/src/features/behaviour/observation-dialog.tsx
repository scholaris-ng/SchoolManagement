import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStudentSearch } from '@/features/students/api';
import {
  useRecordObservation,
} from './api';
import type { BehaviourTrait } from '@/types/behaviour';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ObservationDialog({
  open,
  onOpenChange,
  traits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traits: BehaviourTrait[];
}) {
  const record = useRecordObservation();
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const results = useStudentSearch(query, { enabled: query.length >= 2 });

  const [traitId, setTraitId] = useState('');
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState('');

  const valid = Boolean(student && traitId && rating > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record an observation</DialogTitle>
          <DialogDescription>
            A short note now is worth more than a guess at the end of term.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="obs-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button data-cy="behaviour-change" variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  data-cy="behaviour-query"
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
                          data-cy={`behaviour-student-result-${match.id}`}
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

          <div className="space-y-1.5">
            <Label htmlFor="obs-trait" required>
              Trait
            </Label>
            <NativeSelect
              data-cy="obs-trait"
              id="obs-trait"
              value={traitId}
              onChange={(event) => setTraitId(event.target.value)}
            >
              <option value="">Select a trait</option>
              {traits.map((trait) => (
                <option key={trait.id} value={trait.id}>
                  {trait.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Rating</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  data-cy={`behaviour-rating-${value}`}
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                  className={cn(
                    'size-10 rounded-md border text-sm font-medium transition-colors',
                    rating === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="obs-note">Note</Label>
            <Textarea
              data-cy="obs-note"
              id="obs-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What happened? One sentence is enough."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="behaviour-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="behaviour-record"
            loading={record.isPending}
            disabled={!valid}
            onClick={() =>
              student &&
              void record
                .mutateAsync({
                  studentId: student.id,
                  traitId,
                  rating,
                  note: note.trim() || undefined,
                })
                .then(() => {
                  onOpenChange(false);
                  setStudent(null);
                  setNote('');
                })
            }
          >
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
