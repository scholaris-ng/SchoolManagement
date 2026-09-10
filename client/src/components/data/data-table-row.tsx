import { Fragment, memo } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/primitives';
import type { Column } from './data-table.types';

/**
 * One row of the shared table, in each of its two layouts.
 *
 * Both are wrapped in `React.memo` because a table re-renders on every keystroke
 * in the search box, every selection change and every background refetch, and
 * without this each of those re-runs `column.cell()` for every cell on the page.
 *
 * Memoising only pays off while the props stay referentially stable, so the
 * callers' side of the bargain is:
 *   - `columns` built with `useMemo`;
 *   - `onRowClick` and `rowClassName` built with `useCallback`;
 *   - `onToggleSelect` — handled here, `DataTable` already stabilises it.
 *
 * `interactive` and `selected` are passed as booleans rather than derived from
 * larger objects so a change to one row cannot invalidate its neighbours.
 */

interface RowProps<T> {
  row: T;
  id: string;
  columns: Column<T>[];
  selected: boolean;
  selectable: boolean;
  interactive: boolean;
  dataCy?: string;
  onRowClick?: (row: T) => void;
  onToggleSelect: (id: string) => void;
  rowClassName?: (row: T) => string | undefined;
}

function DataTableRowInner<T>({
  row,
  id,
  columns,
  selected,
  selectable,
  interactive,
  dataCy,
  onRowClick,
  onToggleSelect,
  rowClassName,
}: RowProps<T>) {
  return (
    <tr
      data-cy={dataCy ? `${dataCy}-row` : undefined}
      data-row-id={id}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={cn(
        'transition-colors',
        selected ? 'bg-primary-subtle' : 'hover:bg-muted/50',
        interactive && 'cursor-pointer',
        rowClassName?.(row),
      )}
    >
      {selectable && (
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(id)}
            data-cy={dataCy ? `${dataCy}-select-${id}` : undefined}
            aria-label={`Select row ${id}`}
          />
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.id}
          className={cn(
            'px-3 py-2.5 align-middle',
            column.align === 'right' && 'text-right',
            column.align === 'center' && 'text-center',
            column.sticky && 'sticky left-0 z-10 bg-card',
            column.className,
          )}
        >
          {column.cell(row)}
        </td>
      ))}
    </tr>
  );
}

function DataTableCardInner<T>({
  row,
  id,
  columns,
  selected,
  selectable,
  dataCy,
  onRowClick,
  onToggleSelect,
}: Omit<RowProps<T>, 'interactive' | 'rowClassName'>) {
  return (
    <li
      // Distinct from the desktop `-row`: both layouts are in the DOM at once
      // (one hidden by a breakpoint), so sharing a selector would make every
      // row appear twice to a test.
      data-cy={dataCy ? `${dataCy}-card` : undefined}
      data-row-id={id}
      className={cn('p-4', selected && 'bg-primary-subtle')}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(id)}
              data-cy={dataCy ? `${dataCy}-select-${id}` : undefined}
              aria-label={`Select row ${id}`}
            />
          </div>
        )}
        <dl className="min-w-0 flex-1 space-y-1.5">
          {columns.map((column, index) => (
            <Fragment key={column.id}>
              {index === 0 ? (
                <dd className="text-sm font-medium text-foreground">
                  {(column.mobileCell ?? column.cell)(row)}
                </dd>
              ) : (
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {column.header}
                  </dt>
                  <dd className="min-w-0 text-right">{(column.mobileCell ?? column.cell)(row)}</dd>
                </div>
              )}
            </Fragment>
          ))}
        </dl>
      </div>
    </li>
  );
}

/**
 * `memo` erases the generic parameter, so each is cast back to its generic
 * signature. The cast is safe: the runtime component is untouched.
 */
export const DataTableRow = memo(DataTableRowInner) as <T>(
  props: RowProps<T>,
) => React.ReactElement;

export const DataTableCard = memo(DataTableCardInner) as <T>(
  props: Omit<RowProps<T>, 'interactive' | 'rowClassName'>,
) => React.ReactElement;
