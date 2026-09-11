import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  emptyArray,
  emptyPage,
  placeholderListSchema,
} from '../../../shared/placeholder/unbuiltModule';

/**
 * Everything the school says to families: messages, announcements and news.
 *
 * Grouped the way the permission catalogue groups them, and empty for the same
 * reason as the rest — no conversation, message, announcement or post is stored
 * anywhere. Notifications are the exception next door: those have real tables
 * and a real module already.
 *
 * Nothing that writes is routed. An inbox that silently accepts a reply is
 * worse than a screen that has not been built, because a parent would believe
 * the school had been written to; the same goes for an announcement a head
 * teacher believes went out.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

/* -- Messaging -------------------------------------------------------------- */

router.get('/conversations', authorise('message.read'), validate(placeholderListSchema), emptyPage);

/**
 * Who a user may write to. Empty rather than assembled from the staff and
 * guardian tables: that policy belongs to this module, and guessing it here
 * would put the wrong addresses in front of somebody.
 */
router.get(
  '/message-contacts',
  authorise('message.read'),
  validate(placeholderListSchema),
  emptyArray,
);

/* -- Broadcast -------------------------------------------------------------- */

router.get(
  '/announcements',
  authorise('announcement.read'),
  validate(placeholderListSchema),
  emptyPage,
);

/** The public-facing feed. Reading it needs no more than seeing the website. */
router.get('/news', authorise('announcement.read', 'news.manage'), validate(placeholderListSchema), emptyPage);

export default router;
