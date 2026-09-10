import rateLimit, { type Options } from 'express-rate-limit';
import { ApiResponse } from '../response/apiResponse';
import { ErrorCode } from '../../config/constants';
import { env } from '../../config/env';

/**
 * Rate limiting (spec section 40).
 *
 * Keyed by authenticated user where one exists, so a whole school behind a
 * single NAT address does not share one bucket — a real problem for the
 * Nigerian schools this is built for.
 */
const shared: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.identity?.firebaseUid ?? req.ip ?? 'unknown',
  handler: (_req, res) => {
    res
      .status(429)
      .json(
        ApiResponse.error(ErrorCode.RateLimited, 'Too many requests. Please slow down.'),
      );
  },
  skip: () => env.isTest,
};

export const apiRateLimiter = rateLimit({
  ...shared,
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
});

/** Tighter budget for session establishment and anything that sends mail. */
export const authRateLimiter = rateLimit({
  ...shared,
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.authMax,
});
