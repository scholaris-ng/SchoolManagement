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

/**
 * The public website's forms — an admission application, and whatever follows
 * it. These are the only writes with no account behind them, so the key is
 * always the caller's address and the budget is a family's worth of
 * submissions rather than an application's.
 *
 * An hour, deliberately longer than the general window: a script filling an
 * admissions list with rubbish is slowed by the window it has to wait out, not
 * by the count inside it.
 */
export const publicFormRateLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});
