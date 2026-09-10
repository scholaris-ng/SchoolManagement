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
import { useSaveLevel } from '@/features/academics/api';
import type { SchoolLevel } from '@/types/academics';

export function LevelDialog({
  state,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; level?: SchoolLevel };
  nextSequence: number;
  onClose: () => void;
}) {
  const save = useSaveLevel();
  const [name, setName] = useState(state.level?.name ?? '');
  const [code, setCode] = useState(state.level?.code ?? '');
  const [sequence, setSequence] = useState(String(state.level?.sequence ?? nextSequence));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.level ? 'Edit level' : 'New level'}</DialogTitle>
          <DialogDescription>
            Sequence sets the order children are promoted through.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="level-name" required>
              Name
            </Label>
            <Input
              data-cy="level-name"
              id="level-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Year 7, or JSS 1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="level-code">Code</Label>
              <Input
                data-cy="level-code"
                id="level-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level-sequence" required>
                Sequence
              </Label>
              <Input
                data-cy="level-sequence"
                id="level-sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(event) => setSequence(event.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-4" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-4"
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.level?.id,
                  values: {
                    name: name.trim(),
                    code: code.trim() || name.trim().toUpperCase().replace(/\s+/g, ''),
                    sequence: Number(sequence),
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
