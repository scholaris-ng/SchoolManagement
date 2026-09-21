import { describe, expect, it, vi } from 'vitest';
import type { ListQuery, Paginated } from '@/types/api';
import { fetchAllPages } from './fetch-all-pages';

/** A server holding `total` numbered rows, answering in whatever page size it is asked for. */
function serverWith(total: number) {
  return vi.fn(async (query: ListQuery): Promise<Paginated<number>> => {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const items = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => start + i);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  });
}

describe('fetchAllPages', () => {
  it('walks every page and returns the rows in order', async () => {
    const fetchPage = serverWith(450);
    const result = await fetchAllPages(fetchPage, {});

    expect(result.items).toHaveLength(450);
    expect(result.items[0]).toBe(0);
    expect(result.items[449]).toBe(449);
    expect(result.total).toBe(450);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('asks for the server maximum per page, whatever page and size the screen was on', async () => {
    const fetchPage = serverWith(10);
    await fetchAllPages(fetchPage, { page: 4, pageSize: 25 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 200 });
  });

  it('sends the filters, the sort and the date interval on every request', async () => {
    const fetchPage = serverWith(300);
    const query = {
      search: 'ada',
      sortBy: 'paidAt',
      sortDir: 'desc' as const,
      method: 'CASH',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    };
    await fetchAllPages(fetchPage, query);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    for (const [sent] of fetchPage.mock.calls) {
      expect(sent).toMatchObject(query);
    }
  });

  it('returns nothing, and stops, when nothing matches', async () => {
    const fetchPage = serverWith(0);
    const result = await fetchAllPages(fetchPage, { dateFrom: '2026-01-01' });

    expect(result).toEqual({ items: [], total: 0, truncated: false });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stops at the guard and says so, rather than walking forever', async () => {
    // 50 pages of 200 is the guard; 10,100 rows is one page more than it allows.
    const fetchPage = serverWith(10_100);
    const result = await fetchAllPages(fetchPage, {});

    expect(result.items).toHaveLength(10_000);
    expect(result.total).toBe(10_100);
    expect(result.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(50);
  });

  it('is not truncated when the last allowed page is also the last page', async () => {
    const result = await fetchAllPages(serverWith(10_000), {});

    expect(result.items).toHaveLength(10_000);
    expect(result.truncated).toBe(false);
  });

  it('lets a failed page fail the whole export instead of returning a partial file', async () => {
    const fetchPage = serverWith(600);
    fetchPage.mockRejectedValueOnce(new Error('offline'));

    await expect(fetchAllPages(fetchPage, {})).rejects.toThrow('offline');
  });
});
