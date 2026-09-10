import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ApiResponse, type ErrorDetail } from '../response/apiResponse';
import { ErrorCode } from '../../config/constants';

/**
 * Schema validation, run before the controller body ever executes
 * (spec section 36, `server_arch.md` section 4).
 *
 * The parsed result — coerced and defaulted — is written to `req.validated`.
 * Controllers read only from there, so by the time business logic sees a value
 * it is typed and in range.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      res
        .status(422)
        .json(
          ApiResponse.error(
            ErrorCode.Validation,
            'Validation failed',
            formatZodErrors(result.error),
          ),
        );
      return;
    }

    req.validated = result.data as Request['validated'];
    next();
  };

export function formatZodErrors(error: ZodError): ErrorDetail[] {
  return error.errors.map((issue) => {
    // Drop the leading `body` / `query` / `params` segment so the field name
    // matches what the form actually registered — react-hook-form maps these
    // straight onto its own field errors (`ApiError.fieldErrors()`).
    const path = issue.path.slice(1).join('.');
    return {
      field: path || issue.path.join('.'),
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    };
  });
}
