import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlation id for a request.
 *
 * The client already generates one per call and sends it as `X-Request-Id`
 * (see `client/src/lib/http.ts`), so a user reporting a failed action can be
 * traced straight to the log line and the audit row. We honour theirs when it
 * looks sane and mint one otherwise.
 */
const SAFE_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('x-request-id');
  req.requestId = supplied && SAFE_ID.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
