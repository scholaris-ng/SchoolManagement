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
      message: humanise(issue),
      code: issue.code,
    };
  });
}

/**
 * Every message here reaches a school administrator, not a developer.
 *
 * Schemas carry their own wording for the rules a person can act on ("Enter the
 * street address"), and that is used as written. What is replaced are Zod's
 * structural defaults, which describe the request rather than the form: nobody
 * filling in a settings page can act on "Unrecognized key(s) in object" or
 * "Expected string, received number".
 */
function humanise(issue: ZodError['errors'][number]): string {
  switch (issue.code) {
    case 'unrecognized_keys':
      // The caller sent fields this endpoint does not accept — a whole record
      // echoed back instead of the edited fields, most often. It is a bug in
      // the caller, so the message says what to do rather than naming keys.
      return 'This form sent details the server does not accept. Reload the page and try again.';
    case 'invalid_type':
      return issue.received === 'undefined'
        ? 'This is required.'
        : 'That value is not in the format this field expects.';
    default:
      return issue.message;
  }
}
