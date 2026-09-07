import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListQuery, SortDirection } from '@/types/api';
import { useDebouncedValue } from './use-debounced-value';

export interface ListQueryState {
  /** Ready to hand straight to an API client. */
  query: ListQuery;
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortDir?: SortDirection;
  filters: Record<string, string | undefined>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSort: (sortBy: string, sortDir: SortDirection) => void;
  setFilter: (key: string, value: string | undefined) => void;
  reset: () => void;
  isFiltered: boolean;
}

/**
 * List state lives in the URL.
 *
 * That makes a filtered view shareable ("the JSS 2 debtors screen"), survives
 * a refresh, and makes the browser's back button behave the way users expect
 * after they drill into a record and return.
 */
export function useListQuery(options: {
  filterKeys?: string[];
  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortDir?: SortDirection;
  /** Distinguishes two lists rendered on the same route. */
  namespace?: string;
  searchDebounceMs?: number;
} = {}): ListQueryState {
  const {
    filterKeys = [],
    defaultPageSize = 25,
    defaultSortBy,
    defaultSortDir = 'asc',
    namespace,
    searchDebounceMs = 350,
  } = options;

  const [params, setParams] = useSearchParams();
  const prefix = namespace ? `${namespace}_` : '';
  const nameOf = useCallback((key: string) => `${prefix}${key}`, [prefix]);

  const page = Number(params.get(nameOf('page')) ?? 1) || 1;
  const pageSize = Number(params.get(nameOf('size')) ?? defaultPageSize) || defaultPageSize;
  const search = params.get(nameOf('q')) ?? '';
  const sortBy = params.get(nameOf('sort')) ?? defaultSortBy;
  const sortDir = (params.get(nameOf('dir')) as SortDirection | null) ?? defaultSortDir;

  const debouncedSearch = useDebouncedValue(search, searchDebounceMs);

  const filters = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const key of filterKeys) {
      result[key] = params.get(nameOf(key)) ?? undefined;
    }
    return result;
  }, [filterKeys, params, nameOf]);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, { resetPage = true } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          if (resetPage) next.delete(nameOf('page'));
          return next;
        },
        { replace: true },
      );
    },
    [setParams, nameOf],
  );

  const setPage = useCallback(
    (value: number) =>
      update(
        (next) => {
          if (value <= 1) next.delete(nameOf('page'));
          else next.set(nameOf('page'), String(value));
        },
        { resetPage: false },
      ),
    [update, nameOf],
  );

  const setPageSize = useCallback(
    (value: number) =>
      update((next) => {
        if (value === defaultPageSize) next.delete(nameOf('size'));
        else next.set(nameOf('size'), String(value));
      }),
    [update, nameOf, defaultPageSize],
  );

  const setSearch = useCallback(
    (value: string) =>
      update((next) => {
        if (!value) next.delete(nameOf('q'));
        else next.set(nameOf('q'), value);
      }),
    [update, nameOf],
  );

  const setSort = useCallback(
    (nextSortBy: string, nextSortDir: SortDirection) =>
      update(
        (next) => {
          next.set(nameOf('sort'), nextSortBy);
          next.set(nameOf('dir'), nextSortDir);
        },
        { resetPage: false },
      ),
    [update, nameOf],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) =>
      update((next) => {
        if (!value) next.delete(nameOf(key));
        else next.set(nameOf(key), value);
      }),
    [update, nameOf],
  );

  const reset = useCallback(
    () =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          [...filterKeys, 'q', 'page', 'sort', 'dir'].forEach((key) => next.delete(nameOf(key)));
          return next;
        },
        { replace: true },
      ),
    [setParams, filterKeys, nameOf],
  );

  const query = useMemo<ListQuery>(() => {
    const result: ListQuery = { page, pageSize };
    if (debouncedSearch) result.search = debouncedSearch;
    if (sortBy) {
      result.sortBy = sortBy;
      result.sortDir = sortDir;
    }
    for (const [key, value] of Object.entries(filters)) {
      if (value) result[key] = value;
    }
    return result;
  }, [page, pageSize, debouncedSearch, sortBy, sortDir, filters]);

  return {
    query,
    page,
    pageSize,
    search,
    sortBy,
    sortDir,
    filters,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    reset,
    isFiltered: Boolean(debouncedSearch) || Object.values(filters).some(Boolean),
  };
}
