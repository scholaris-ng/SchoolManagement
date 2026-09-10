import type { PageMeta, SortDirection } from '@/types/api';

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
   * - `<cy>-row`               every desktop table row, each also carrying
   *                            `data-row-id`
   * - `<cy>-card`              the same rows in the mobile card layout. Both
   *                            layouts render at once (a breakpoint hides one),
   *                            so they need separate selectors
   * - `<cy>-sort-<columnId>`   a sortable column header
   * - `<cy>-select-all`        the header checkbox
   * - `<cy>-select-<rowId>`    a row checkbox
   */
  'data-cy'?: string;
}
