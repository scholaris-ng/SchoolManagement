import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { paginatedResult } from '../../../shared/pagination/paginate';
import {
  fetchCurriculaSchema,
  fetchLessonNotesSchema,
  fetchSchemesSchema,
} from '../validators/curriculum.schema';

/**
 * Curricula, schemes of work and lesson notes — three lists, none of which has
 * anything behind it yet.
 *
 * No curriculum, topic, objective, scheme or note is stored anywhere. The lists
 * are served so the three screens render their own empty states and their
 * filter bars work, which is what a teacher opening the page before any
 * curriculum has been loaded should see.
 *
 * Nothing that writes is routed, and neither is scheme generation: that one
 * builds a term of weekly plans from a curriculum, and generating them from a
 * curriculum that does not exist would produce a document nobody asked for.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

/** The client types this one as a bare array, not a page. */
router.get(
  '/curricula',
  authorise('curriculum.read'),
  validate(fetchCurriculaSchema),
  (_req: Request, res: Response) => {
    res.status(200).json(ApiResponse.ok([]));
  },
);

router.get(
  '/schemes',
  authorise('scheme.read'),
  validate(fetchSchemesSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = req.validated!.query as { page: number; pageSize: number };
      res.status(200).json(ApiResponse.paginated(paginatedResult([], page, pageSize, 0)));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/lesson-notes',
  authorise('lessonnote.read'),
  validate(fetchLessonNotesSchema),
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
