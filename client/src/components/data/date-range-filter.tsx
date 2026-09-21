import { formatDate } from '@/lib/format';
import { Input } from '@/components/ui/input';

export interface DateRangeFilterDefinition {
  /** What the dates are of, as a short word: "Paid", "Issued". Prefixes the inputs and the chips. */
  label: string;
  /** URL / query keys the two ends are stored under. Both hold `YYYY-MM-DD`. */
  fromKey: string;
  toKey: string;
  /** Writes both keys in one go — see `useListQuery().setFilters` for why it is not two calls. */
  onChange: (patch: Record<string, string | undefined>) => void;
}

/**
 * Two native date inputs, either of which may be left empty.
 *
 * Moving one end past the other drags the other along with it rather than
 * leaving an interval the server would refuse — the same thing the calendar's
 * event dialog does with its start and end. `min` and `max` keep the picker
 * itself from offering the impossible dates in the first place.
 */
export function DateRangeFilter({
  definition,
  values,
}: {
  definition: DateRangeFilterDefinition;
  values: Record<string, string | undefined>;
}) {
  const { label, fromKey, toKey, onChange } = definition;
  const from = values[fromKey];
  const to = values[toKey];

  return (
    <div role="group" aria-label={`${label} between`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <Input
        data-cy={`filter-${fromKey}`}
        type="date"
        aria-label={`${label} from`}
        value={from ?? ''}
        max={to || undefined}
        onChange={(event) => {
          const value = event.target.value;
          onChange({
            [fromKey]: value || undefined,
            ...(value && to && value > to ? { [toKey]: value } : {}),
          });
        }}
        className="h-9 w-auto text-sm"
      />
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        to
      </span>
      <Input
        data-cy={`filter-${toKey}`}
        type="date"
        aria-label={`${label} to`}
        value={to ?? ''}
        min={from || undefined}
        onChange={(event) => {
          const value = event.target.value;
          onChange({
            [toKey]: value || undefined,
            ...(value && from && value < from ? { [fromKey]: value } : {}),
          });
        }}
        className="h-9 w-auto text-sm"
      />
    </div>
  );
}

/** The removable chips for whichever ends are set, in the shape `FilterBar` already renders. */
export function dateRangeChips(
  definition: DateRangeFilterDefinition,
  values: Record<string, string | undefined>,
): { key: string; label: string; value: string }[] {
  const chips: { key: string; label: string; value: string }[] = [];
  const from = values[definition.fromKey];
  const to = values[definition.toKey];
  if (from) chips.push({ key: definition.fromKey, label: `${definition.label} from`, value: formatDate(from) });
  if (to) chips.push({ key: definition.toKey, label: `${definition.label} to`, value: formatDate(to) });
  return chips;
}
