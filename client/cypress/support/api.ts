import type { ApiErrorDetail, PageMeta } from '@/types/api';

/**
 * Builders for the wire envelope.
 *
 * Every stub body must mirror `types/api.ts` exactly — that is the contract the
 * transport layer parses, and a stub shaped any other way tests a code path the
 * app does not have. Build bodies with these helpers rather than by hand.
 */

/** A successful response: `{ success: true, data }`. */
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta === undefined
    ? { success: true as const, data }
    : { success: true as const, data, meta };
}

/** Page metadata for a list of `total` rows. */
export function listMeta(total: number, overrides: Partial<PageMeta> = {}): PageMeta {
  const pageSize = overrides.pageSize ?? 25;
  const page = overrides.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    ...overrides,
  };
}

/** A paginated list body: `{ success: true, data: { items, meta } }`. */
export function paged<T>(items: T[], overrides: Partial<PageMeta> = {}) {
  return ok({ items, meta: listMeta(overrides.total ?? items.length, overrides) });
}

/**
 * A failure: `{ success: false, error: { code, message } }`.
 *
 * Pair it with a non-2xx `statusCode` on the intercept — the transport treats
 * the HTTP status and the envelope as one signal.
 */
export function fail(message: string, code = 'INTERNAL_ERROR', details?: ApiErrorDetail[]) {
  return {
    success: false as const,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/** A 422 with field-level messages, as the API emits for a rejected form. */
export function validationFailure(details: ApiErrorDetail[], message = 'Validation failed.') {
  return fail(message, 'VALIDATION_ERROR', details);
}

/** Matches one `/api/v1` path, with or without a query string. */
export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `**/api/v1${clean}`;
}
