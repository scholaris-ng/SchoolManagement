import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { MessagingController } from '../controllers/messaging.controller';
import { fetchSmsLogSchema, sendTestSmsSchema } from '../validators/messaging.schema';

/**
 * Outbound messaging: what the school has sent by SMS, and the controls for
 * it. Everything here costs money or reveals parents' numbers, so it all sits
 * behind `notification.send` — the permission for administrator-initiated
 * messages, which is what these are.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

router.get(
  '/messaging/sms',
  authorise('notification.send'),
  validate(fetchSmsLogSchema),
  MessagingController.fetchSmsLog,
);

// Readable by whoever manages settings too: the balance is shown on the
// settings screen, and reading it neither costs money nor reveals a number.
router.get(
  '/messaging/sms/status',
  authorise('notification.send', 'settings.manage'),
  MessagingController.smsStatus,
);

router.post(
  '/messaging/sms/test',
  authorise('notification.send'),
  validate(sendTestSmsSchema),
  MessagingController.sendTestSms,
);

/**
 * Sends today's birthday greetings for the caller's school right now, whatever
 * the configured send time. Idempotent: anyone already greeted today is
 * skipped, so pressing it after the scheduled run is harmless.
 */
router.post(
  '/messaging/birthday-greetings/run',
  authorise('notification.send'),
  MessagingController.runBirthdayGreetings,
);

export default router;
