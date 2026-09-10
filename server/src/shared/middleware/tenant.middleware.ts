import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { SessionService } from '../../modules/auth/services/session.service';
import { buildRequestContext } from '../types/context';

/**
 * Resolves which school this request acts under (spec section 4).
 *
 * The browser sends `X-School-Id`, and it is treated strictly as a hint about
 * which of the caller's *own* memberships they mean. The membership row is what
 * supplies `schoolId` downstream, so a header naming a school the user has no
 * row for resolves to nothing rather than to that school.
 *
 * Runs after `authMiddleware` and before any controller.
 */
export async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const identity = req.identity;
    if (!identity) throw AppError.unauthenticated();

    const service = SessionService.Instance;
    const user = await service.ensureUser(identity);
    const rows = await service.loadMemberships(user.id);

    const requested = readSchoolIdHeader(req);
    const row = service.selectMembership(rows, requested);

    if (!row) {
      throw requested
        ? AppError.forbidden('You do not have access to that school.')
        : AppError.forbidden('Your account is not linked to a school yet.');
    }

    const blocked = service.staffBlockReason(row);
    if (blocked) throw AppError.forbidden(blocked);

    req.context = buildRequestContext({
      user: service.toUserContext(user),
      membership: service.toMembershipContext(row, user.isPlatformAdmin),
      requestId: req.requestId,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 400) ?? null,
    });

    next();
  } catch (error) {
    next(error);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed header is ignored rather than rejected — it names nothing either way. */
function readSchoolIdHeader(req: Request): string | null {
  const value = req.get('x-school-id')?.trim();
  return value && UUID.test(value) ? value : null;
}

/**
 * The request context, or a clear failure.
 *
 * Controllers call this instead of reaching for `req.context!`, so a route
 * accidentally wired without `tenantMiddleware` fails loudly and immediately
 * rather than reading `undefined.schoolId` somewhere deeper.
 */
export function contextOf(req: Request) {
  if (!req.context) throw AppError.unauthenticated();
  return req.context;
}
