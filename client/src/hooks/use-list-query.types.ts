import type { ListQuery, SortDirection } from '@/types/api';

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
