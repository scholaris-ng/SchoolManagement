import { Fragment, useId } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageMeta, SortDirection } from '@/types/api';
import { Checkbox } from '@/components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/feedback';
import { Pagination } from './pagination';

/**
 * The single table used across the product.
 *
 * Sorting, paging and filtering are *server-side* — the component never
 * receives more rows than one page, which is what keeps a 3,000-student school
 * from shipping 3,000 rows to a phone on 3G (spec sections 35 and 43).
 */
export interface Column<T> {
  id: string;
  header: React.ReactNode;
  /** Field name sent to the API as `sortBy`. Omit to make the column unsortable. */
  sortKey?: string;
  cell: (row: T) => React.ReactNode;
  /** Shown instead of `cell` in the mobile card layout. */
  mobileCell?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  headerClassName?: string;
  /** Hide below `lg` — used for supporting detail that the card view repeats. */
  hideOnMobile?: boolean;
  sticky?: boolean;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;

  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  sortBy?: string;
  sortDir?: SortDirection;
  onSortChange?: (sortBy: string, sortDir: SortDirection) => void;

  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;

  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;

  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;

  /** Accessible caption; required because these tables carry real data. */
  caption: string;
  toolbar?: React.ReactNode;
  className?: string;
  /** Renders a stacked card per row below `lg`. Defaults to true. */
  responsiveCards?: boolean;
  rowClassName?: (row: T) => string | undefined;
  /**
   * Cypress hook. The wrapper carries it verbatim and everything inside is
   * namespaced from it, so one prop makes a whole table addressable:
   *
   * - `<cy>-empty`             the empty state
   * - `<cy>-row`               every row (desktop and mobile card alike),
   *                            each also carrying `data-row-id`
   * - `<cy>-sort-<columnId>`   a sortable column header
   * - `<cy>-select-all`        the header checkbox
   * - `<cy>-select-<rowId>`    a row checkbox
   */
  'data-cy'?: string;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  isLoading,
  isFetching,
  error,
  onRetry,
  meta,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onRowClick,
  rowHref,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  caption,
  toolbar,
  className,
  responsiveCards = true,
  rowClassName,
  'data-cy': dataCy,
}: DataTableProps<T>) {
  const cy = (suffix: string) => (dataCy ? `${dataCy}-${suffix}` : undefined);
  const captionId = useId();
  const selectable = Boolean(onSelectionChange);
  const rows = data ?? [];
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds?.includes(rowKey(r)));
  const someSelected = selectable && rows.some((r) => selectedIds?.includes(rowKey(r))) && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const pageIds = rows.map(rowKey);
    if (allSelected) {
      onSelectionChange((selectedIds ?? []).filter((id) => !pageIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...(selectedIds ?? []), ...pageIds])));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    const current = selectedIds ?? [];
    onSelectionChange(
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortKey || !onSortChange) return;
    const nextDir: SortDirection =
      sortBy === column.sortKey && sortDir === 'asc' ? 'desc' : 'asc';
    onSortChange(column.sortKey, nextDir);
  };

  const visibleColumns = columns;
  const cardColumns = columns.filter((column) => !column.hideOnMobile);

  return (
    <div data-cy={dataCy} className={cn('rounded-lg border border-border bg-card', className)}>
      {toolbar && <div className="border-b border-border p-3">{toolbar}</div>}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} data-cy={cy('error')} />
      ) : isLoading ? (
        <TableSkeleton columns={Math.min(visibleColumns.length, 6)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          data-cy={cy('empty')}
        />
      ) : (
        <>
          {/* Desktop / tablet table --------------------------------------- */}
          <div
            className={cn(
              'scrollbar-thin relative overflow-x-auto',
              responsiveCards && 'hidden lg:block',
              isFetching && 'opacity-60 transition-opacity',
            )}
          >
            <table className="w-full caption-bottom text-sm" aria-describedby={captionId}>
              <caption id={captionId} className="sr-only">
                {caption}
              </caption>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {selectable && (
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleAll}
                        data-cy={cy('select-all')}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  )}
                  {visibleColumns.map((column) => {
                    const isSorted = sortBy === column.sortKey;
                    return (
                      <th
                        key={column.id}
                        scope="col"
                        style={column.width ? { width: column.width } : undefined}
                        aria-sort={
                          isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                        }
                        className={cn(
                          'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          !column.align && 'text-left',
                          column.sticky && 'sticky left-0 z-10 bg-muted/40',
                          column.headerClassName,
                        )}
                      >
                        {column.sortKey && onSortChange ? (
                          <button
                            type="button"
                            data-cy={cy(`sort-${column.id}`)}
                            onClick={() => handleSort(column)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
                              column.align === 'right' && 'flex-row-reverse',
                            )}
                          >
                            {column.header}
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="size-3" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-3" aria-hidden="true" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const id = rowKey(row);
                  const selected = selectedIds?.includes(id);
                  const interactive = Boolean(onRowClick || rowHref);
                  return (
                    <tr
                      key={id}
                      data-cy={cy('row')}
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
                            onCheckedChange={() => toggleOne(id)}
                            data-cy={cy(`select-${id}`)}
                            aria-label={`Select row ${id}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => (
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
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list --------------------------------------------- */}
          {responsiveCards && (
            <ul className="divide-y divide-border lg:hidden">
              {rows.map((row) => {
                const id = rowKey(row);
                const selected = selectedIds?.includes(id);
                return (
                  <li
                    key={id}
                    data-cy={cy('row')}
                    data-row-id={id}
                    className={cn('p-4', selected && 'bg-primary-subtle')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {selectable && (
                        <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleOne(id)}
                            data-cy={cy(`select-${id}`)}
                            aria-label={`Select row ${id}`}
                          />
                        </div>
                      )}
                      <dl className="min-w-0 flex-1 space-y-1.5">
                        {cardColumns.map((column, index) => (
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
                                <dd className="min-w-0 text-right">
                                  {(column.mobileCell ?? column.cell)(row)}
                                </dd>
                              </div>
                            )}
                          </Fragment>
                        ))}
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {meta && meta.total > 0 && onPageChange && (
        <Pagination
          meta={meta}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}
