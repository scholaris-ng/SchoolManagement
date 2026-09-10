import { ErrorCode, type ErrorCodeValue } from '../../config/constants';
import type { ErrorDetail } from '../response/apiResponse';

/**
 * A domain failure with a status and a machine-readable code.
 *
 * Services throw these; the global error handler is the only thing that turns
 * one into a response. Anything that is *not* an AppError is an infrastructure
 * failure and becomes an opaque 500 (spec section 40) — internal detail never
 * reaches the client.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue | string;
  readonly details: ErrorDetail[];
  /** Domain failures are expected; only unexpected ones deserve a stack in the log. */
  readonly isOperational = true;

  constructor(
    message: string,
    statusCode = 400,
    code: ErrorCodeValue | string = ErrorCode.Validation,
    details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(message, 400, ErrorCode.Validation, details);
  }

  static unauthenticated(message = 'You are not signed in.'): AppError {
    return new AppError(message, 401, ErrorCode.Unauthenticated);
  }

  static forbidden(message = 'You do not have permission to do that.'): AppError {
    return new AppError(message, 403, ErrorCode.Forbidden);
  }

  static notFound(what = 'Record'): AppError {
    return new AppError(`${what} was not found.`, 404, ErrorCode.NotFound);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, ErrorCode.Conflict);
  }

  /**
   * A concurrent edit would have been clobbered (spec section 34). Distinct from
   * a plain conflict because the client opens a merge dialog for this one.
   */
  static versionConflict(
    message = 'Someone else changed this record while you were editing it.',
  ): AppError {
    return new AppError(message, 409, ErrorCode.VersionConflict);
  }

  static validation(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(message, 422, ErrorCode.Validation, details);
  }

  static rateLimited(message = 'Too many requests. Please slow down.'): AppError {
    return new AppError(message, 429, ErrorCode.RateLimited);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, ErrorCode.Internal);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
