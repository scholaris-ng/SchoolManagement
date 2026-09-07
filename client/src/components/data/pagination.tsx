import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import type { PageMeta } from '@/types/api';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';

const PAGE_SIZES = [10, 25, 50, 100];

export interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isFetching?: boolean;
  className?: string;
}

/** Builds `1 … 4 5 6 … 20` so the control stays narrow on a phone. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  isFetching,
  className,
}: PaginationProps) {
  const firstRow = (meta.page - 1) * meta.pageSize + 1;
  const lastRow = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col gap-3 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{formatNumber(firstRow)}</span>–
        <span className="font-medium text-foreground">{formatNumber(lastRow)}</span> of{' '}
        <span className="font-medium text-foreground">{formatNumber(meta.total)}</span>
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            Rows
            <NativeSelect
              value={String(meta.pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 w-[4.5rem] text-xs"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={!meta.hasPrevious || isFetching}
            aria-label="First page"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={!meta.hasPrevious || isFetching}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(meta.page, meta.totalPages).map((page, index) =>
              page === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === meta.page ? 'primary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => onPageChange(page)}
                  disabled={isFetching}
                  aria-current={page === meta.page ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                  className="text-xs"
                >
                  {page}
                </Button>
              ),
            )}
          </div>

          <span className="px-2 text-xs text-muted-foreground sm:hidden">
            {meta.page} / {meta.totalPages}
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={!meta.hasNext || isFetching}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(meta.totalPages)}
            disabled={!meta.hasNext || isFetching}
            aria-label="Last page"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
