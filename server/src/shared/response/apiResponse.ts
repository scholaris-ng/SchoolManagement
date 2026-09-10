import { ErrorCode, type ErrorCodeValue } from '../../config/constants';

/**
 * The wire contract, and the only shape any route may return (spec section 35).
 *
 * Note this deviates from the envelope in `server_arch.md` section 5: errors are
 * nested under `error` with a machine-readable `code` rather than flattened
 * alongside a `statusCode`. That is what `Dev Prompt.txt` section 35 specifies
 * and what the finished client parses in `client/src/lib/http.ts`, so it is the
 * binding contract here. The layering rules from `server_arch.md` are otherwise
 * followed unchanged.
 */

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

export interface ErrorDetail {
  field?: string;
  path?: string;
  message: string;
  code?: string;
}

export interface ApiSuccessBody<T> {
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
    details?: ErrorDetail[];
  };
}

export const ApiResponse = {
  ok<T>(data: T, message?: string): ApiSuccessBody<T> {
    return { success: true, data, message };
  },

  created<T>(data: T, message?: string): ApiSuccessBody<T> {
    return { success: true, data, message };
  },

  paginated<T>(page: Paginated<T>, message?: string): ApiSuccessBody<Paginated<T>> {
    return { success: true, data: page, message };
  },

  error(
    code: ErrorCodeValue | string,
    message: string,
    details?: ErrorDetail[],
  ): ApiErrorBody {
    return { success: false, error: { code, message, details } };
  },
};

/** Convenience wrappers so handlers name the failure rather than the status. */
export const errorBodies = {
  unauthenticated: (message = 'You are not signed in.') =>
    ApiResponse.error(ErrorCode.Unauthenticated, message),
  forbidden: (message = 'You do not have permission to do that.') =>
    ApiResponse.error(ErrorCode.Forbidden, message),
  notFound: (what = 'Record') => ApiResponse.error(ErrorCode.NotFound, `${what} was not found.`),
  internal: () => ApiResponse.error(ErrorCode.Internal, 'Internal server error'),
};
