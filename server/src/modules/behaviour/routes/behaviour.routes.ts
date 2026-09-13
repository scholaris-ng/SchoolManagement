import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { BehaviourController } from '../controllers/behaviour.controller';
import {
  awardHousePointsSchema,
  createTraitSchema,
  fetchHousePointsSchema,
  fetchLeaderboardSchema,
  fetchObservationsSchema,
  recordObservationSchema,
  studentBehaviourSchema,
  updateTraitSchema,
} from '../validators/behaviour.schema';

/**
 * Behaviour and house points (spec sections 23 and 24).
 *
 * Traits and scales are the school's configuration (`behaviour.configure`);
 * observations and awards are the record (`behaviour.manage`, `house.manage`
 * to write; `behaviour.read`, `house.read` to read). Every read of a named
 * pupil's record is narrowed to the caller's own children in the service.
 *
 * Collection events moved to their own module (`collection.routes.ts`).
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

router.get('/behaviour/scales', authorise('behaviour.read', 'behaviour.configure'), BehaviourController.scales);
router.get('/behaviour/traits', authorise('behaviour.read', 'behaviour.configure'), BehaviourController.traits);
router.post(
  '/behaviour/traits',
  authorise('behaviour.configure'),
  validate(createTraitSchema),
  BehaviourController.createTrait,
);
router.patch(
  '/behaviour/traits/:id',
  authorise('behaviour.configure'),
  validate(updateTraitSchema),
  BehaviourController.updateTrait,
);

router.get(
  '/behaviour/observations',
  authorise('behaviour.read'),
  validate(fetchObservationsSchema),
  BehaviourController.observations,
);
router.post(
  '/behaviour/observations',
  authorise('behaviour.manage'),
  validate(recordObservationSchema),
  BehaviourController.recordObservation,
);

/** The portal's behaviour tab: one pupil's term, for staff, the pupil or a guardian. */
router.get(
  '/students/:studentId/behaviour',
  authorise('behaviour.read'),
  validate(studentBehaviourSchema),
  BehaviourController.studentRatings,
);

router.get('/house-points', authorise('house.read'), validate(fetchHousePointsSchema), BehaviourController.housePoints);
router.post(
  '/house-points',
  authorise('house.manage'),
  validate(awardHousePointsSchema),
  BehaviourController.awardHousePoints,
);
router.get('/house-leaderboard', authorise('house.read'), validate(fetchLeaderboardSchema), BehaviourController.leaderboard);

export default router;
