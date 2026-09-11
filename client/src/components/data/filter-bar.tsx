import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, SearchInput } from '@/components/ui/input';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  options: FilterOption[];
  /** Label shown for the "no filter" option. */
  allLabel?: string;
}

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Shows a spinner in the search box — a debounce is pending, or the search request is in flight. */
  isSearching?: boolean;
  filters?: FilterDefinition[];
  values?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * The standard list header: search, a row of dropdown filters, active-filter
 * chips and page actions. Filter state is owned by the caller so it can be
 * pushed into the URL and shared/bookmarked.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  isSearching,
  filters = [],
  values = {},
  onFilterChange,
  onReset,
  actions,
  className,
  children,
}: FilterBarProps) {
  const activeFilters = filters
    .map((filter) => {
      const value = values[filter.key];
      if (!value) return null;
      const option = filter.options.find((candidate) => candidate.value === value);
      return option ? { key: filter.key, label: filter.label, value: option.label } : null;
    })
    .filter((entry): entry is { key: string; label: string; value: string } => entry !== null);

  const hasActive = activeFilters.length > 0 || Boolean(search);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {onSearchChange && (
            <SearchInput
              data-cy="filter-search"
              value={search ?? ''}
              onValueChange={onSearchChange}
              placeholder={searchPlaceholder}
              isSearching={isSearching}
              className="w-full sm:w-64"
            />
          )}
          {filters.map((filter) => (
            <label key={filter.key} className="sr-only-focusable contents">
              <span className="sr-only">{filter.label}</span>
              <NativeSelect
                data-cy={`filter-${filter.key}`}
                value={values[filter.key] ?? ''}
                onChange={(event) => onFilterChange?.(filter.key, event.target.value || undefined)}
                aria-label={filter.label}
                className="h-9 w-auto min-w-[9rem] text-sm"
              >
                <option value="">{filter.allLabel ?? `All ${filter.label.toLowerCase()}`}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {hasActive && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {activeFilters.map((filter) => (
            <Badge key={filter.key} tone="primary" className="gap-1 pr-1">
              <span className="text-muted-foreground">{filter.label}:</span>
              {filter.value}
              <button
                type="button"
                data-cy={`filter-chip-remove-${filter.key}`}
                onClick={() => onFilterChange?.(filter.key, undefined)}
                className="grid size-4 place-items-center rounded-full hover:bg-primary/20"
                aria-label={`Remove ${filter.label} filter`}
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              data-cy="filter-reset"
              onClick={onReset}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Bulk-action bar that appears once rows are selected. */
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      data-cy="selection-bar"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2"
    >
      <p className="text-sm font-medium text-primary" data-cy="selection-count">
        {count} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button
        variant="ghost"
        size="sm"
        data-cy="selection-clear"
        onClick={onClear}
        className="ml-auto h-7 text-xs"
      >
        Clear selection
      </Button>
    </div>
  );
}
