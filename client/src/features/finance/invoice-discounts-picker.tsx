import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import type { AppliedDiscount, Discount } from '@/types/finance';
import { describeDiscountValue } from './discount-scope';
import { useSaveDiscount } from './api';
import { DiscountDialog } from './discount-dialog';
import { Button } from '@/components/ui/button';

/** One discount ticked for this bill, and which of its lines it comes off. */
export interface ChosenDiscount {
  discountId: string;
  /** Fee item ids, drawn from this invoice's own lines. Empty means every eligible line. */
  feeItemIds: string[];
}

/**
 * Which discounts come off one invoice, and which of its lines each one hits.
 *
 * A discount the student already holds is ticked and locked — it applies to
 * every bill, in full, whether or not anyone remembers it. The rest are the
 * school's other active discounts, ticked here for this bill alone; once
 * ticked, a bursar can narrow one down to just the lines it should cover
 * (Tuition, say, not Exam) rather than leaving it general. A discount already
 * limited to certain fee items under Finance → Fees → Discounts only ever
 * offers those as choices here — a bill can narrow a discount's reach, never
 * widen it past what the discount was defined for.
 *
 * "New discount" saves straight into the school's discount list and ticks it
 * here immediately, so a one-off waiver never needs a separate trip to Fees
 * first.
 */
export function InvoiceDiscountsPicker({
  discounts,
  feeItems,
  grantedIds,
  selected,
  onChange,
  applied,
  studentName,
}: {
  discounts: Discount[];
  /** This invoice's own lines (fee item id and name) — the choices offered for scoping a discount. */
  feeItems: { id: string; name: string }[];
  grantedIds: string[];
  selected: ChosenDiscount[];
  onChange: (next: ChosenDiscount[]) => void;
  applied: AppliedDiscount[];
  studentName?: string;
}) {
  const { can } = useAuth();
  const canManageDiscounts = can('fee.manage');
  const [newDiscountOpen, setNewDiscountOpen] = useState(false);
  const saveDiscount = useSaveDiscount();

  const waived = new Map(applied.map((entry) => [entry.discountId, entry.amount]));

  const toggleDiscount = (discount: Discount) =>
    onChange(
      selected.some((entry) => entry.discountId === discount.id)
        ? selected.filter((entry) => entry.discountId !== discount.id)
        : [...selected, { discountId: discount.id, feeItemIds: [] }],
    );

  const toggleLine = (
    discountId: string,
    eligible: { id: string; name: string }[],
    feeItemId: string,
  ) => {
    const entry = selected.find((row) => row.discountId === discountId);
    const current =
      entry && entry.feeItemIds.length > 0 ? entry.feeItemIds : eligible.map((item) => item.id);
    const next = current.includes(feeItemId)
      ? current.filter((id) => id !== feeItemId)
      : [...current, feeItemId];
    // Every eligible line ticked back on is the same as never having narrowed
    // it — collapsing back to "every line" means a fee item added to the
    // invoice afterwards is still covered, rather than silently left out of a
    // discount nobody meant to restrict.
    const feeItemIds = next.length === eligible.length ? [] : next;
    onChange(
      selected.map((row) => (row.discountId === discountId ? { ...row, feeItemIds } : row)),
    );
  };

  return (
    <fieldset className="space-y-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">Discounts</legend>
      <p className="text-xs text-muted-foreground">
        Tick a discount to take it off this invoice, and pick which charges it covers if it
        shouldn't be every one. The reason is recorded on the invoice.
      </p>

      {discounts.length > 0 && (
        <ul className="space-y-2">
          {discounts.map((discount) => {
            const granted = grantedIds.includes(discount.id);
            const entry = selected.find((row) => row.discountId === discount.id);
            const checked = granted || Boolean(entry);
            const amount = waived.get(discount.id);
            const eligible =
              discount.appliesToFeeItemIds.length === 0
                ? feeItems
                : feeItems.filter((item) => discount.appliesToFeeItemIds.includes(item.id));

            return (
              <li key={discount.id} className="space-y-1.5">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    data-cy="invoice-discount-option"
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={checked}
                    disabled={granted}
                    onChange={() => toggleDiscount(discount)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{discount.name}</span>{' '}
                    <span className="text-muted-foreground">
                      · {humanizeEnum(discount.type)} · {describeDiscountValue(discount)}
                    </span>
                    {granted && (
                      <span className="block text-xs text-muted-foreground">
                        {studentName ? `Granted to ${studentName}` : 'Granted to this student'} —
                        always applied
                      </span>
                    )}
                  </span>
                  {checked && (
                    <span className="shrink-0 tabular-nums text-success">
                      {amount !== undefined
                        ? `− ${formatCurrency(amount, 'NGN', { showDecimals: false })}`
                        : 'Nothing to take off'}
                    </span>
                  )}
                </label>
                {entry && eligible.length > 1 && (
                  <fieldset className="ml-7 flex flex-wrap gap-x-4 gap-y-1">
                    <legend className="text-xs text-muted-foreground">Applies to</legend>
                    {eligible.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <input
                          data-cy="invoice-discount-scope-item"
                          type="checkbox"
                          className="size-3.5 rounded border-input"
                          checked={entry.feeItemIds.length === 0 || entry.feeItemIds.includes(item.id)}
                          onChange={() => toggleLine(discount.id, eligible, item.id)}
                        />
                        {item.name}
                      </label>
                    ))}
                  </fieldset>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManageDiscounts && (
        <>
          <Button
            data-cy="invoice-discount-new"
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNewDiscountOpen(true)}
          >
            <Plus />
            New discount
          </Button>
          <DiscountDialog
            state={{ open: newDiscountOpen }}
            onOpenChange={setNewDiscountOpen}
            saving={saveDiscount.isPending}
            onSave={(values) =>
              saveDiscount.mutateAsync({ values }).then((created) => {
                setNewDiscountOpen(false);
                onChange([...selected, { discountId: created.id, feeItemIds: [] }]);
              })
            }
          />
        </>
      )}
    </fieldset>
  );
}
