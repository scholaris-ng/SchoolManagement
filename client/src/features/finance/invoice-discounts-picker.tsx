import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import type { AppliedDiscount, Discount } from '@/types/finance';
import { describeDiscountValue } from './discount-scope';

/**
 * Which discounts come off one invoice.
 *
 * A discount the student already holds is ticked and locked — it applies to
 * every bill whether or not anyone remembers it. The rest are the school's
 * other active discounts, ticked here for this bill alone. What each would
 * take off is shown beside it once there are charges to take it from.
 */
export function InvoiceDiscountsPicker({
  discounts,
  grantedIds,
  selectedIds,
  onChange,
  applied,
  studentName,
}: {
  discounts: Discount[];
  grantedIds: string[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  applied: AppliedDiscount[];
  studentName?: string;
}) {
  if (discounts.length === 0) return null;

  const waived = new Map(applied.map((entry) => [entry.discountId, entry.amount]));

  return (
    <fieldset className="space-y-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">Discounts</legend>
      <p className="text-xs text-muted-foreground">
        Tick a discount to take it off this invoice. The reason is recorded on the invoice.
      </p>
      <ul className="space-y-1.5">
        {discounts.map((discount) => {
          const granted = grantedIds.includes(discount.id);
          const checked = granted || selectedIds.includes(discount.id);
          const amount = waived.get(discount.id);
          return (
            <li key={discount.id}>
              <label className="flex items-center gap-3 text-sm">
                <input
                  data-cy="invoice-discount-option"
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={checked}
                  disabled={granted}
                  onChange={() =>
                    onChange(
                      selectedIds.includes(discount.id)
                        ? selectedIds.filter((id) => id !== discount.id)
                        : [...selectedIds, discount.id],
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{discount.name}</span>{' '}
                  <span className="text-muted-foreground">
                    · {humanizeEnum(discount.type)} · {describeDiscountValue(discount)}
                  </span>
                  {granted && (
                    <span className="block text-xs text-muted-foreground">
                      {studentName ? `Granted to ${studentName}` : 'Granted to this student'} — always
                      applied
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
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
