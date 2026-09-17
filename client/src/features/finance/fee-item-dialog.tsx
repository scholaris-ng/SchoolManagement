import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { usePaymentDestinations } from './use-payment-destinations';
import { Toggle } from './fees-page-parts';
import type { FeeItem } from '@/types/finance';
import type { FeeItemInput } from './finance.endpoints';
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
  onSave: (values: Partial<FeeItemInput>) => Promise<unknown>;
  saving: boolean;
}) {
  const destinations = usePaymentDestinations();

  const [name, setName] = useState(state.item?.name ?? '');
  const [code, setCode] = useState(state.item?.code ?? '');
  const [amount, setAmount] = useState(String(state.item?.amount ?? ''));
  const [category, setCategory] = useState(state.item?.category ?? 'TUITION');
  const [description, setDescription] = useState(state.item?.description ?? '');
  const [isOptional, setIsOptional] = useState(state.item?.isOptional ?? false);
  const [isRecurring, setIsRecurring] = useState(state.item?.isRecurring ?? true);
  const [isActive, setIsActive] = useState(state.item?.isActive ?? true);
  const [hasQuantity, setHasQuantity] = useState(state.item?.hasQuantity ?? false);
  const [paymentDestinationIds, setPaymentDestinationIds] = useState<string[]>(
    (state.item?.accounts ?? []).map((account) => account.id),
  );

  const valid = name.trim() && code.trim() && Number(amount) > 0;

  const toggleDestination = (id: string) =>
    setPaymentDestinationIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
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
            <legend className="text-sm font-medium">
              Payment accounts
              <span className="ml-1 font-normal text-muted-foreground">
                (optional — shown on invoices so families know where to pay this charge)
              </span>
            </legend>

            {(destinations.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment accounts saved yet. Add one from the "Payment accounts" tab, then come
                back here to pick it.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {(destinations.data ?? []).map((destination) => (
                  <li key={destination.id} className="px-3 py-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        data-cy="fee-item-account"
                        type="checkbox"
                        className="size-4 shrink-0 rounded border-input"
                        checked={paymentDestinationIds.includes(destination.id)}
                        onChange={() => toggleDestination(destination.id)}
                      />
                      <span className="min-w-0 truncate">
                        {destination.label ? `${destination.label} — ` : ''}
                        {destination.bankName} · {destination.accountNumber}
                        <span className="text-muted-foreground"> ({destination.accountName})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

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
            <Toggle
              label="Billed by quantity"
              description="Lets a bursar set how many units to bill on an invoice, such as a locker or a textbook. Left off, this charge is always billed once."
              checked={hasQuantity}
              onChange={setHasQuantity}
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
                hasQuantity,
                paymentDestinationIds,
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
