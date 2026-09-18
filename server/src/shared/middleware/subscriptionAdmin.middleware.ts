import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { SessionService } from '../../modules/auth/services/session.service';
import { isSubscriptionAdmin } from '../utils/subscriptionAdmin';

/**
 * Admits only the people listed in `SUBSCRIPTION_ADMIN_EMAILS`.
 *
 * Runs after `authMiddleware`, in place of `tenantMiddleware` rather than after
 * it: these routes act on *other* schools, so there is no membership to resolve
 * and none must be needed — an administrator whose own school has lapsed must
 * still be able to reach them.
 *
 * "Verified" here means what it means everywhere else in the application: the
 * address was proved with the emailed code (`users.email_verified`). The token's
 * own `email_verified` claim is not used — an account registered through this
 * application's own flow never has it set, so requiring it would refuse the very
 * people the list names.
 */
export async function subscriptionAdminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const identity = req.identity;
    if (!identity) throw AppError.unauthenticated();

    const service = SessionService.Instance;
    const user = await service.ensureUser(identity);
    service.assertEmailVerified(user);

    if (!isSubscriptionAdmin(user)) {
      throw AppError.forbidden('You do not have permission to manage school subscriptions.');
    }

    req.subscriptionAdmin = { userId: user.id, email: user.email, displayName: user.displayName };
    next();
  } catch (error) {
    next(error);
  }
}
