import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { Toggle } from './fees-page-parts';
import type { FeeItem } from '@/types/finance';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORIES } from './fees-page-constants';

/**
 * Pieces used by `fees-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function FeeItemDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  state: { open: boolean; item?: FeeItem };
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<FeeItem>) => Promise<unknown>;
  saving: boolean;
}) {
  const [name, setName] = useState(state.item?.name ?? '');
  const [code, setCode] = useState(state.item?.code ?? '');
  const [amount, setAmount] = useState(String(state.item?.amount ?? ''));
  const [category, setCategory] = useState(state.item?.category ?? 'TUITION');
  const [description, setDescription] = useState(state.item?.description ?? '');
  const [isOptional, setIsOptional] = useState(state.item?.isOptional ?? false);
  const [isRecurring, setIsRecurring] = useState(state.item?.isRecurring ?? true);
  const [isActive, setIsActive] = useState(state.item?.isActive ?? true);

  const valid = name.trim() && code.trim() && Number(amount) > 0;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.item ? 'Edit fee item' : 'New fee item'}</DialogTitle>
          <DialogDescription>
            Changing an amount affects invoices issued from now on — invoices already sent keep the
            amount they were billed at.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fee-name" required>
              Name
            </Label>
            <Input
              data-cy="fee-name"
              id="fee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Tuition"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-code" required>
              Code
            </Label>
            <Input data-cy="fee-code" id="fee-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-amount" required>
              Amount
            </Label>
            <Input
              data-cy="fee-amount"
              id="fee-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-category">Category</Label>
            <NativeSelect
              data-cy="fee-category"
              id="fee-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as FeeItem['category'])}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fee-description">Description</Label>
            <Textarea
              data-cy="fee-description"
              id="fee-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="sr-only">Fee item options</legend>
            <Toggle
              label="Optional charge"
              description="Only billed to families who opt in, such as the school bus."
              checked={isOptional}
              onChange={setIsOptional}
            />
            <Toggle
              label="Charged every term"
              checked={isRecurring}
              onChange={setIsRecurring}
            />
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="finance-fees-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="finance-fees-save"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                amount: Number(amount),
                category: category as FeeItem['category'],
                description: description.trim() || null,
                isOptional,
                isRecurring,
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
