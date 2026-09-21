import { useCallback } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import type { SortDirection } from '@/types/api';

/**
 * The writes behind `useListQuery`.
 *
 * Each one edits the URL rather than local state, and all but paging and
 * sorting reset the page — moving to a different filter and staying on page 7
 * of the old result is never what the user meant.
 */
export function useListQueryActions(
  setParams: SetURLSearchParams,
  nameOf: (key: string) => string,
  defaultPageSize: number,
  filterKeys: string[],
) {
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

  /**
   * Several filters in one URL write. `setParams` in react-router v6 does not
   * queue: two `setFilter` calls in the same tick each start from the params of
   * the last render, so the second silently undoes the first. Anything that
   * has to move two keys together — a date range being kept in order — goes
   * through here instead.
   */
  const setFilters = useCallback(
    (patch: Record<string, string | undefined>) =>
      update((next) => {
        for (const [key, value] of Object.entries(patch)) {
          if (!value) next.delete(nameOf(key));
          else next.set(nameOf(key), value);
        }
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

  return { setPage, setPageSize, setSearch, setSort, setFilter, setFilters, reset };
}
