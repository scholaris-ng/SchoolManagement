import { useCallback, useId } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortDirection } from '@/types/api';
import { Checkbox } from '@/components/ui/primitives';
import { DataTableRow, DataTableCard } from './data-table-row';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/feedback';
import { Pagination } from './pagination';
import type { Column, DataTableProps } from './data-table.types';

export type { Column, DataTableProps } from './data-table.types';


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

  // Stable across renders so the memoised rows below are not invalidated by a
  // fresh handler identity on every parent render.
  const toggleOne = useCallback(
    (id: string) => {
      if (!onSelectionChange) return;
      const current = selectedIds ?? [];
      onSelectionChange(
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
      );
    },
    [onSelectionChange, selectedIds],
  );

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
                  return (
                    <DataTableRow
                      key={id}
                      row={row}
                      id={id}
                      columns={visibleColumns}
                      selected={Boolean(selectedIds?.includes(id))}
                      selectable={selectable}
                      interactive={Boolean(onRowClick || rowHref)}
                      dataCy={dataCy}
                      onRowClick={onRowClick}
                      onToggleSelect={toggleOne}
                      rowClassName={rowClassName}
                    />
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
                return (
                  <DataTableCard
                    key={id}
                    row={row}
                    id={id}
                    columns={cardColumns}
                    selected={Boolean(selectedIds?.includes(id))}
                    selectable={selectable}
                    dataCy={dataCy}
                    onRowClick={onRowClick}
                    onToggleSelect={toggleOne}
                  />
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
