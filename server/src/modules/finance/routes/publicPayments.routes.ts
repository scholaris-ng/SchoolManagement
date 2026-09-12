import { Router } from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ravenWebhookSchema } from '../validators/payments.schema';
import { PaymentsController } from '../controllers/payments.controller';

/**
 * Where Raven posts when money lands in a collection account.
 *
 * Mounted ahead of `authMiddleware` in app.ts: Raven has no session with us
 * and no tenant to name. What stands in for both is the shared secret in the
 * body, checked in constant time, and the account number in the credit —
 * which this side issued, and so knows which school and child it belongs to.
 *
 * Not rate limited like the public forms are. A limiter keyed by address
 * would throttle Raven itself on a busy fee-collection morning, and the
 * secret check already refuses anyone else in a single comparison.
 *
 * Register this URL in Atlas → Settings → Keys & Webhook, with the same secret
 * as `RAVEN_WEBHOOK_SECRET`. It must be reachable over HTTPS from the public
 * internet — a tunnel in development, the real domain in production.
 */
const router = Router();

router.post('/public/webhooks/raven', validate(ravenWebhookSchema), PaymentsController.ravenWebhook);

export default router;
