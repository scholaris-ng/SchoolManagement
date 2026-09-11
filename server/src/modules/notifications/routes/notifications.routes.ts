import { Router } from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  fetchNotificationsSchema,
  notificationIdParamSchema,
  registerPushTokenSchema,
  updatePreferenceSchema,
} from '../validators/notifications.schema';
import { NotificationsController } from '../controllers/notifications.controller';

/**
 * An inbox is self-scoped, so none of these carry an `authorise(...)` check.
 *
 * There is no `notification.read` permission to check against — every route
 * here reads or writes `context.user.id`'s own rows and nobody else's, the same
 * way a parent's guardian record scopes itself in `GuardiansService`. The
 * `notification.send` permission guards administrator-initiated broadcasts,
 * which are not part of this module yet.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

// Ahead of `/notifications/:id/read` so the literal path is not read as an id.
router.get('/notifications/unread-count', NotificationsController.unreadCount);

router.get('/notifications/preferences', NotificationsController.fetchPreferences);

router.patch(
  '/notifications/preferences',
  validate(updatePreferenceSchema),
  NotificationsController.updatePreference,
);

router.get(
  '/notifications',
  validate(fetchNotificationsSchema),
  NotificationsController.fetchAll,
);

router.post('/notifications/read-all', NotificationsController.markAllRead);

router.patch(
  '/notifications/:id/read',
  validate(notificationIdParamSchema),
  NotificationsController.markRead,
);

router.post(
  '/notifications/push-tokens',
  validate(registerPushTokenSchema),
  NotificationsController.registerPushToken,
);

export default router;
