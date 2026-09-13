import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { CollectionController } from '../controllers/collection.controller';
import {
  createPickupPersonSchema,
  fetchCollectionEventsSchema,
  releaseChildSchema,
  studentPickupParamSchema,
  updatePickupPersonSchema,
} from '../validators/collection.schema';

/**
 * Child collection (spec section 12). Reading a child's pickup list and
 * collection history is `collection.read`, narrowed to a parent's own
 * children in the service; changing the list or releasing a child is
 * `collection.manage`.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

router.get(
  '/students/:studentId/pickup',
  authorise('collection.read'),
  validate(studentPickupParamSchema),
  CollectionController.studentPickup,
);
router.post(
  '/students/:studentId/pickup',
  authorise('collection.manage'),
  validate(createPickupPersonSchema),
  CollectionController.addPerson,
);
router.patch(
  '/students/:studentId/pickup/:id',
  authorise('collection.manage'),
  validate(updatePickupPersonSchema),
  CollectionController.updatePerson,
);

router.get(
  '/collection/events',
  authorise('collection.read'),
  validate(fetchCollectionEventsSchema),
  CollectionController.events,
);
router.post(
  '/collection/events',
  authorise('collection.manage'),
  validate(releaseChildSchema),
  CollectionController.release,
);

export default router;
