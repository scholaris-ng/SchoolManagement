import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { paginatedResult } from '../../../shared/pagination/paginate';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * The history of past bulk imports, and nothing that runs one.
 *
 * No import job is recorded anywhere yet, so the history is empty. It is served
 * rather than left to 404 because the import screen shows this list beside its
 * upload form, and a school arriving with a spreadsheet should meet an empty
 * history, not a broken page.
 *
 * `validate` and `commit` stay unrouted on purpose. Committing a file writes
 * hundreds of student records in one transaction, and that is the last thing to
 * stub out — a fake success there would report an import that never happened.
 */
const router = Router();

const fetchImportJobsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  }),
});

router.use(authMiddleware, tenantMiddleware);

router.get(
  '/imports',
  authorise('import.run'),
  validate(fetchImportJobsSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = req.validated!.query as { page: number; pageSize: number };
      res.status(200).json(ApiResponse.paginated(paginatedResult([], page, pageSize, 0)));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
