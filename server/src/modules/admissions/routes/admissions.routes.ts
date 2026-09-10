import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { paginatedResult } from '../../../shared/pagination/paginate';
import { fetchAdmissionsSchema, type FetchAdmissionsQuery } from '../validators/admissions.schema';

/**
 * The applicant list, and nothing behind it yet.
 *
 * Applicants are not modelled: there is no application table, no stage history
 * and no conversion path into the register. The list is still served so the
 * admissions screen renders its own empty state, which says "no applications"
 * rather than showing a failed request.
 *
 * Everything else the client calls here — a single application, a stage
 * transition, and converting an accepted applicant into a student — writes, and
 * a write with nothing to write to is not worth faking. Those stay unrouted
 * until the tables exist.
 *
 * The funnel chart lives in the analytics module with the other aggregates,
 * because it is read by the analytics screen as well as this one.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get(
  '/admissions',
  authorise('admission.read'),
  validate(fetchAdmissionsSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = req.validated!.query as FetchAdmissionsQuery;
      res.status(200).json(ApiResponse.paginated(paginatedResult([], page, pageSize, 0)));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
