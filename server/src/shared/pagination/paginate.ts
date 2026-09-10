import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../config/constants';
import type { PageMeta, Paginated } from '../response/apiResponse';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface ListParams extends PaginationParams {
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

export function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function buildMeta(page: number, pageSize: number, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function paginatedResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> {
  return { items, meta: buildMeta(page, pageSize, total) };
}

export function clampPageSize(pageSize: number | undefined): number {
  if (!pageSize || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

/**
 * Only columns named here may reach an ORDER BY. Sort keys arrive from the query
 * string, so an allowlist is what keeps a caller from ordering by a column that
 * is not indexed — or one that is not theirs to see.
 */
export function safeSortColumn(
  requested: string | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  if (requested && allowed.includes(requested)) return requested;
  return fallback;
}
