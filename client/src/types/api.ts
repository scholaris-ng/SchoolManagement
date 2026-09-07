/**
 * Wire contract shared with the Express API (section 35 of the spec).
 * These types are the single source of truth for every response shape the
 * client understands; feature code never inspects raw fetch responses.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface ApiErrorDetail {
  path?: string;
  field?: string;
  message: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export type SortDirection = 'asc' | 'desc';

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
  [key: string]: unknown;
}

/** Canonical error codes the API is expected to emit. */
export const ApiErrorCode = {
  Validation: 'VALIDATION_ERROR',
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  VersionConflict: 'VERSION_CONFLICT',
  RateLimited: 'RATE_LIMITED',
  Network: 'NETWORK_ERROR',
  Offline: 'OFFLINE',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
