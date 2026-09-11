import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListQuery, SortDirection } from '@/types/api';
import { useDebouncedValue } from './use-debounced-value';
import { useListQueryActions } from './use-list-query-actions';
import type { ListQueryState } from './use-list-query.types';

export type { ListQueryState } from './use-list-query.types';
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

  const { setPage, setPageSize, setSearch, setSort, setFilter, reset } = useListQueryActions(
    setParams,
    nameOf,
    defaultPageSize,
    filterKeys,
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
    isSearchPending: search !== debouncedSearch,
  };
}
