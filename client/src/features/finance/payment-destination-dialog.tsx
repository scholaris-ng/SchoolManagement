import { useState } from 'react';
import type { PaymentDestination } from '@/types/finance';
import type { PaymentDestinationInput } from './finance.endpoints';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * One of the school's own bank accounts, edited in the one place it lives —
 * see `PaymentDestination`. A fee item and a custom bill only ever pick one
 * of these by id, so an edit made here is what everyone picking it sees next,
 * with no need to go find every place that used to hold its own copy.
 */
export function PaymentDestinationDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  state: { open: boolean; destination?: PaymentDestination };
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<PaymentDestinationInput>) => Promise<unknown>;
  saving: boolean;
}) {
  const existing = state.destination;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [bankName, setBankName] = useState(existing?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(existing?.accountName ?? '');

  const valid = Boolean(bankName.trim() && accountNumber.trim() && accountName.trim());

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit payment account' : 'New payment account'}</DialogTitle>
          <DialogDescription>
            Picked by fee items and custom bills to tell families where to pay. Editing one here
            updates it everywhere it is picked — a bill already issued keeps the details it was
            raised under.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="destination-label">Label</Label>
            <Input
              data-cy="payment-destination-label"
              id="destination-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Main account, PTA account"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination-bank" required>
              Bank name
            </Label>
            <Input
              data-cy="payment-destination-bank"
              id="destination-bank"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="e.g. GTBank"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination-number" required>
              Account number
            </Label>
            <Input
              data-cy="payment-destination-number"
              id="destination-number"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="destination-name" required>
              Account name
            </Label>
            <Input
              data-cy="payment-destination-name"
              id="destination-name"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            data-cy="payment-destination-cancel"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-cy="payment-destination-save"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                label: label.trim() || null,
                bankName: bankName.trim(),
                accountNumber: accountNumber.trim(),
                accountName: accountName.trim(),
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
