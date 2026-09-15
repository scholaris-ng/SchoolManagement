import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { usePaymentDestinations } from './use-payment-destinations';
import type { CustomBill } from '@/types/finance';
import type { CustomBillInput } from './finance.endpoints';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LineDraft {
  description: string;
  amount: string;
}

const BLANK_LINE: LineDraft = { description: '', amount: '' };

/**
 * A bill for whoever or whatever falls outside the real invoicing system —
 * a contractor, a visitor, a one-time charge with no enrolled student
 * behind it. See `CustomBill` for why it never touches a student's balance.
 */
export function CustomBillDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  /**
   * `mode: 'duplicate'` prefills every field from `bill` exactly like editing
   * does, but the dialog reads as making a new one — `custom-bills-page.tsx`
   * is what actually sends it to `create` rather than `update`.
   */
  state: { open: boolean; bill?: CustomBill; mode?: 'edit' | 'duplicate' };
  onOpenChange: (open: boolean) => void;
  onSave: (values: CustomBillInput) => Promise<unknown>;
  saving: boolean;
}) {
  const existing = state.bill;
  const isDuplicate = state.mode === 'duplicate';
  const destinations = usePaymentDestinations();

  const [payerName, setPayerName] = useState(existing?.payerName ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [lines, setLines] = useState<LineDraft[]>(
    existing && existing.lines.length > 0
      ? existing.lines.map((line) => ({ description: line.description, amount: String(line.amount) }))
      : [{ ...BLANK_LINE }],
  );

  const addLine = () => setLines((current) => [...current, { ...BLANK_LINE }]);
  const removeLine = (index: number) =>
    setLines((current) => current.filter((_, position) => position !== index));
  const patchLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );

  const [paymentDestinationIds, setPaymentDestinationIds] = useState<string[]>(
    (existing?.accounts ?? []).map((account) => account.id),
  );
  const toggleDestination = (id: string) =>
    setPaymentDestinationIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const currency = 'NGN';
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const validLines = lines.filter((line) => line.description.trim() && Number(line.amount) > 0);
  const valid = Boolean(payerName.trim() && validLines.length > 0);

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isDuplicate ? 'Duplicate bill' : existing ? 'Edit bill' : 'New bill'}
          </DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'A copy of an earlier bill, ready to adjust before saving as a new one.'
              : "For anyone or anything outside your enrolled students — a contractor, a visitor, a one-off charge. It's never billed against a student's balance."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bill-payer" required>
              Bill to
            </Label>
            <Input
              data-cy="custom-bill-payer"
              id="bill-payer"
              value={payerName}
              onChange={(event) => setPayerName(event.target.value)}
              placeholder="e.g. John Doe, ABC Contractors"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Charges</legend>
            <ul className="space-y-2">
              {lines.map((line, index) => (
                <li key={index} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {index === 0 && <Label htmlFor={`bill-line-description-${index}`}>Description</Label>}
                    <Input
                      data-cy="custom-bill-line-description"
                      id={`bill-line-description-${index}`}
                      value={line.description}
                      onChange={(event) => patchLine(index, { description: event.target.value })}
                      placeholder="e.g. Plumbing repairs"
                    />
                  </div>
                  <div className="w-36 space-y-1.5">
                    {index === 0 && <Label htmlFor={`bill-line-amount-${index}`}>Amount</Label>}
                    <Input
                      data-cy="custom-bill-line-amount"
                      id={`bill-line-amount-${index}`}
                      type="number"
                      min={0}
                      value={line.amount}
                      onChange={(event) => patchLine(index, { amount: event.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    aria-label={`Remove ${line.description || `charge ${index + 1}`}`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus />
              Add charge
            </Button>
            <p className="text-right text-sm text-muted-foreground">
              Total:{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(total, currency, { showDecimals: false })}
              </span>
            </p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Payment accounts
              <span className="ml-1 font-normal text-muted-foreground">
                (optional — any one of them settles the total)
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
                        data-cy="custom-bill-account"
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

          <div className="space-y-1.5">
            <Label htmlFor="bill-note">Note to print</Label>
            <Textarea
              data-cy="custom-bill-note"
              id="bill-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Payment due within 7 days."
            />
            <p className="text-xs text-muted-foreground">Shown in bold on the printed copy.</p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="custom-bill-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="custom-bill-save"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                payerName: payerName.trim(),
                lines: validLines.map((line) => ({
                  description: line.description.trim(),
                  amount: Number(line.amount),
                })),
                // Sent even when empty — `undefined` here would drop the key
                // from the request body entirely, and the server reads an
                // absent key as "leave the existing note alone", not "clear
                // it". The server already turns '' into null on its side.
                note: note.trim(),
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
