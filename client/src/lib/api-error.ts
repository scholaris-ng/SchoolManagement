import { ApiErrorCode, type ApiErrorCodeValue, type ApiErrorDetail } from '@/types/api';

/**
 * A single error type for everything that can go wrong between a component and
 * the API, so UI code has one thing to narrow on rather than juggling
 * `Response`, `TypeError` and thrown strings.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: ApiErrorDetail[];
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details ?? [];
    this.requestId = params.requestId;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401 || this.code === ApiErrorCode.Unauthenticated;
  }

  get isForbidden(): boolean {
    return this.status === 403 || this.code === ApiErrorCode.Forbidden;
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === ApiErrorCode.NotFound;
  }

  get isValidation(): boolean {
    return this.status === 422 || this.code === ApiErrorCode.Validation;
  }

  /** A concurrent edit clobbered ours — surfaced as a conflict dialog, not a toast. */
  get isVersionConflict(): boolean {
    return this.status === 409 && this.code === ApiErrorCode.VersionConflict;
  }

  get isOffline(): boolean {
    return this.code === ApiErrorCode.Offline || this.code === ApiErrorCode.Network;
  }

  /** Retrying these is safe and likely to help; 4xx generally is not. */
  get isRetryable(): boolean {
    return this.isOffline || this.status === 429 || this.status >= 500;
  }

  /** Maps `details` onto react-hook-form field errors. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const detail of this.details) {
      const key = detail.field ?? detail.path;
      if (key) out[key] = detail.message;
    }
    return out;
  }

  static offline(): ApiError {
    return new ApiError({
      code: ApiErrorCode.Offline,
      message: 'You appear to be offline. The change has been queued and will retry automatically.',
      status: 0,
    });
  }

  static network(message = 'Could not reach the server.'): ApiError {
    return new ApiError({ code: ApiErrorCode.Network, message, status: 0 });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function errorCode(error: unknown): ApiErrorCodeValue | string | undefined {
  return isApiError(error) ? error.code : undefined;
}
