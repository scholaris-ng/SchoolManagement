import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  emptyArray,
  emptyPage,
  placeholderListSchema,
} from '../../../shared/placeholder/unbuiltModule';

/**
 * The finance screens, with no ledger behind them.
 *
 * There is no fee item, structure, discount, invoice or payment table. The
 * lists are served empty so the bursar's screens draw, which matches what
 * `/finance/overview` already reports and what the admin dashboard already
 * shows for money.
 *
 * Nothing here writes. Raising an invoice, recording a payment and reconciling
 * one are the last things that should ever be stubbed: a fake receipt is a
 * claim that a family paid.
 *
 * Debtors is a derived list rather than a table — who owes what, from invoices
 * against payments — so it stays empty for as long as both of those do.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

/* -- Definitions: what the school charges ---------------------------------- */

router.get('/fee-items', authorise('finance.read', 'fee.manage'), validate(placeholderListSchema), emptyPage);

router.get(
  '/fee-structures',
  authorise('finance.read', 'fee.manage'),
  validate(placeholderListSchema),
  emptyPage,
);

/** The client types discounts as a bare array, not a page. */
router.get(
  '/discounts',
  authorise('finance.read', 'discount.manage'),
  validate(placeholderListSchema),
  emptyArray,
);

/* -- The ledger: what is owed and what arrived ----------------------------- */

router.get('/invoices', authorise('finance.read'), validate(placeholderListSchema), emptyPage);

router.get('/payments', authorise('finance.read'), validate(placeholderListSchema), emptyPage);

router.get('/debtors', authorise('finance.read'), validate(placeholderListSchema), emptyPage);

export default router;
