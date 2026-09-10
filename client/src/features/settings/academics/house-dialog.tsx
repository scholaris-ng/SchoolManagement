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
import { useSaveHouse } from '@/features/academics/api';
import type { House } from '@/types/academics';

export function HouseDialog({
  state,
  onClose,
}: {
  state: { open: boolean; house?: House };
  onClose: () => void;
}) {
  const save = useSaveHouse();
  const [name, setName] = useState(state.house?.name ?? '');
  const [color, setColor] = useState(state.house?.color ?? '#2563eb');
  const [motto, setMotto] = useState(state.house?.motto ?? '');

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.house ? 'Edit house' : 'New house'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="house-name" required>
              Name
            </Label>
            <Input
              data-cy="house-name"
              id="house-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Blue House"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house-color">Colour</Label>
            <div className="flex items-center gap-2">
              <input
                data-cy="house-color"
                id="house-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded border border-input"
              />
              <Input data-cy="academics-settings-color" value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house-motto">Motto</Label>
            <Input
              data-cy="house-motto"
              id="house-motto"
              value={motto}
              onChange={(event) => setMotto(event.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-7" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-7"
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.house?.id,
                  values: { name: name.trim(), color, motto: motto.trim() || null },
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
