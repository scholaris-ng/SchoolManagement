/**
 * Pieces used by `fees-page`, split one per component so none outgrows
 * the limit in section 17 of the frontend guide.
 */
export { FeeItemDialog } from './fee-item-dialog';
export { DiscountDialog } from './discount-dialog';


export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        data-cy="finance-fees-checked"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 rounded border-input"
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
