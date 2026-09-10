import type { AuthIdentity, RequestContext } from './context';

/**
 * Request augmentation.
 *
 * `validated` is populated by the validation middleware and is the only thing a
 * controller may read input from — never `req.body` directly (spec section 36).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id echoed back to the client and written into audit rows. */
      requestId: string;
      /** Set by `authMiddleware` once the Firebase ID token is verified. */
      identity?: AuthIdentity;
      /** Set by `tenantMiddleware` once a membership has been resolved. */
      context?: RequestContext;
      validated?: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

export {};
