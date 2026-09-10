import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { QueryFailedError } from 'typeorm';
import { isAppError } from '../errors/AppError';
import { ApiResponse } from '../response/apiResponse';
import { ErrorCode } from '../../config/constants';
import { env } from '../../config/env';

/**
 * The single place an error becomes a response (spec section 40).
 *
 * Domain failures carry their own status and code. Everything else is treated as
 * an infrastructure fault: logged in full server-side, returned to the client as
 * a bare 500 with no internal detail, no stack, no SQL.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Required for Express to recognise this as an error handler.
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    res
      .status(err.statusCode)
      .json(
        ApiResponse.error(err.code, err.message, err.details.length > 0 ? err.details : undefined),
      );
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large.'
        : 'That file could not be accepted.';
    res.status(422).json(ApiResponse.error(ErrorCode.Validation, message));
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res
      .status(400)
      .json(ApiResponse.error(ErrorCode.Validation, 'The request body is not valid JSON.'));
    return;
  }

  if (err instanceof QueryFailedError) {
    // 23505 is a unique violation — a real conflict the user can act on, rather
    // than a fault. Every other database error stays opaque.
    const code = (err as QueryFailedError & { code?: string }).code;
    if (code === '23505') {
      console.error(`[${req.requestId}] Unique violation:`, err.message);
      res
        .status(409)
        .json(ApiResponse.error(ErrorCode.Conflict, 'That record already exists.'));
      return;
    }
  }

  console.error(`[${req.requestId}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);

  res
    .status(500)
    .json(
      ApiResponse.error(
        ErrorCode.Internal,
        env.isProduction ? 'Internal server error' : describe(err),
      ),
    );
}

/** Development only — never reached when `NODE_ENV=production`. */
function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return 'Internal server error';
}

/** Anything under the API prefix that matched no route. */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(
      ApiResponse.error(ErrorCode.NotFound, `No API route matches ${req.method} ${req.path}.`),
    );
}
