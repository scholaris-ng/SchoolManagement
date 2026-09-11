import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ApiResponse } from '../../../shared/response/apiResponse';
import {
  emptyArray,
  emptyPage,
  placeholderListSchema,
} from '../../../shared/placeholder/unbuiltModule';
import { LeaderboardService } from '../services/leaderboard.service';

/** The leaderboard is read per term; today every term shows the same totals. */
const fetchLeaderboardSchema = z.object({
  query: z.object({ termId: z.string().uuid().optional() }).strict(),
});

/**
 * Behaviour, house points and collection events — the pastoral side of the
 * record, none of which has a table yet.
 *
 * Houses themselves do exist and are served by the academics module; what is
 * missing is everything that happens to a house or a pupil afterwards: the
 * traits a school rates, the scale it rates them on, the observations staff
 * record, and the points awarded.
 *
 * Nothing that writes is routed. A behaviour observation is a note about a
 * named child that a parent may later read, and it must never be invented.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get(
  '/behaviour/observations',
  authorise('behaviour.read'),
  validate(placeholderListSchema),
  emptyPage,
);

/** Traits and scales are the school's own configuration, typed as bare arrays. */
router.get(
  '/behaviour/traits',
  authorise('behaviour.read', 'behaviour.configure'),
  validate(placeholderListSchema),
  emptyArray,
);

router.get(
  '/behaviour/scales',
  authorise('behaviour.read', 'behaviour.configure'),
  validate(placeholderListSchema),
  emptyArray,
);

router.get('/house-points', authorise('house.read'), validate(placeholderListSchema), emptyPage);

/**
 * The one read here that is not empty. Houses exist and carry a points total,
 * so the standings are real; only the per-pupil ranking below them waits on the
 * award table. See `LeaderboardService`.
 */
router.get(
  '/house-leaderboard',
  authorise('house.read'),
  validate(fetchLeaderboardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(200)
        .json(ApiResponse.ok(await LeaderboardService.Instance.fetch(contextOf(req))));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/collection/events',
  authorise('collection.read'),
  validate(placeholderListSchema),
  emptyPage,
);

export default router;
