import { env } from './env';
import { ApiError } from './api-error';
import type { ApiResponse, ListQuery } from '@/types/api';

/**
 * Thin, dependency-inverted HTTP client.
 *
 * It knows nothing about Firebase or React: the auth token and active tenant
 * are supplied by injected providers, which keeps the transport testable and
 * lets the identity provider be swapped without touching feature code.
 */

type TokenProvider = () => Promise<string | null>;
type TenantProvider = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenProvider = async () => null;
let getTenantId: TenantProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureHttp(options: {
  tokenProvider?: TokenProvider;
  tenantProvider?: TenantProvider;
  onUnauthorized?: UnauthorizedHandler;
}): void {
  if (options.tokenProvider) getToken = options.tokenProvider;
  if (options.tenantProvider) getTenantId = options.tenantProvider;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

export interface RequestOptions {
  /** Query parameters; `undefined`, `null` and `''` entries are dropped. */
  query?: ListQuery | Record<string, unknown>;
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. Defaults to 30s. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Send a raw body (e.g. FormData) instead of JSON. */
  raw?: boolean;
  /** Optimistic-locking version echoed back as `If-Match`. */
  version?: number;
}

export function buildQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        params.append(key, String(item));
      }
    } else if (value instanceof Date) {
      params.append(key, value.toISOString());
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw ApiError.offline();
  }

  const url = `${env.apiBaseUrl}${path}${buildQueryString(options.query)}`;
  const requestId = createRequestId();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
    ...options.headers,
  };

  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // The server re-derives the tenant from the session and treats this purely as
  // a hint for which membership the user is acting under. It is never trusted
  // for authorisation (spec section 4).
  const tenantId = getTenantId();
  if (tenantId) headers['X-School-Id'] = tenantId;

  if (options.version !== undefined) headers['If-Match'] = String(options.version);

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (options.raw) {
      payload = body as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
      credentials: 'same-origin',
    });
  } catch (cause) {
    if (controller.signal.aborted && options.signal?.aborted) throw cause;
    if (controller.signal.aborted) throw ApiError.network('The request timed out.');
    throw ApiError.network();
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (response.ok) return undefined as T;
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: `Unexpected ${response.status} response from the server.`,
      status: response.status,
      requestId,
    });
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || json.success === false) {
    const error =
      json.success === false
        ? new ApiError({
            code: json.error.code,
            message: json.error.message,
            status: response.status,
            details: json.error.details,
            requestId,
          })
        : new ApiError({
            code: 'INTERNAL_ERROR',
            message: 'Request failed.',
            status: response.status,
            requestId,
          });

    if (error.isUnauthenticated) onUnauthorized();
    throw error;
  }

  return json.data;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};

export type Http = typeof http;
