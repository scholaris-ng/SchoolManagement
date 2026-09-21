import type { ListQuery, Paginated } from '@/types/api';

/** The server's own ceiling (`MAX_PAGE_SIZE`): asking for more is a 400, not a bigger page. */
const PAGE_SIZE = 200;

/** A runaway guard, not a limit anyone should meet: 50 pages of 200 is 10,000 rows. */
const MAX_PAGES = 50;

export interface AllPages<T> {
  items: T[];
  /** What the server said matched, which is more than `items.length` when `truncated`. */
  total: number;
  /** True when the guard stopped the walk before the last page. */
  truncated: boolean;
}

/**
 * Walks a paginated endpoint to the end, so an export can cover every row a
 * filter matches rather than only the page on screen.
 *
 * Page and page size in `query` are ignored — the walk sets its own. Everything
 * else (search, sort, filters, a date interval) is sent unchanged on every
 * request, so the file matches the table it was exported from. Pages are read
 * one after another rather than in parallel, so a large export is a steady
 * trickle of requests, not a burst.
 */
export async function fetchAllPages<T>(
  fetchPage: (query: ListQuery) => Promise<Paginated<T>>,
  query: ListQuery,
): Promise<AllPages<T>> {
  const items: T[] = [];
  let total = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage({ ...query, page, pageSize: PAGE_SIZE });
    items.push(...result.items);
    total = result.meta.total;
    if (!result.meta.hasNext) return { items, total, truncated: false };
  }

  return { items, total, truncated: true };
}
