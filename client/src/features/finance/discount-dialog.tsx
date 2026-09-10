import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { Toggle } from './fees-page-parts';
import type { Discount } from '@/types/finance';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DISCOUNT_TYPES } from './fees-page-constants';

export function DiscountDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  state: { open: boolean; discount?: Discount };
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<Discount>) => Promise<unknown>;
  saving: boolean;
}) {
  const [name, setName] = useState(state.discount?.name ?? '');
  const [type, setType] = useState(state.discount?.type ?? 'SIBLING');
  const [mode, setMode] = useState(state.discount?.mode ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(state.discount?.value ?? ''));
  const [description, setDescription] = useState(state.discount?.description ?? '');
  const [isActive, setIsActive] = useState(state.discount?.isActive ?? true);

  const valid = name.trim() && Number(value) > 0;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.discount ? 'Edit discount' : 'New discount'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="discount-name" required>
              Name
            </Label>
            <Input
              data-cy="discount-name"
              id="discount-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Second child"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-type">Type</Label>
            <NativeSelect
              data-cy="discount-type"
              id="discount-type"
              value={type}
              onChange={(event) => setType(event.target.value as Discount['type'])}
            >
              {DISCOUNT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {humanizeEnum(option)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-mode">Applied as</Label>
            <NativeSelect
              data-cy="discount-mode"
              id="discount-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as Discount['mode'])}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-value" required>
              {mode === 'PERCENTAGE' ? 'Percentage' : 'Amount'}
            </Label>
            <Input
              data-cy="discount-value"
              id="discount-value"
              type="number"
              min={0}
              max={mode === 'PERCENTAGE' ? 100 : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="discount-description">Description</Label>
            <Textarea
              data-cy="discount-description"
              id="discount-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="finance-fees-cancel-2" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="finance-fees-save-2"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                name: name.trim(),
                type: type as Discount['type'],
                mode: mode as Discount['mode'],
                value: Number(value),
                description: description.trim() || null,
                isActive,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
