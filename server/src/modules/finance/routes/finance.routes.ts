import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  emptyArray,
  emptyPage,
  placeholderListSchema,
} from '../../../shared/placeholder/unbuiltModule';
import { FeeItemsController } from '../controllers/feeItems.controller';
import {
  createFeeItemSchema,
  fetchFeeItemsSchema,
  updateFeeItemSchema,
} from '../validators/feeItems.schema';

/**
 * The finance screens. Fee items are real; the ledger behind them is not yet.
 *
 * A fee item is a definition — what the school charges for — so it landed with
 * bulk import, which had to have somewhere to put the rows. Structures,
 * invoices and payments still have no table and are served empty.
 *
 * Nothing else here writes. Raising an invoice, recording a payment and
 * reconciling one are the last things that should ever be stubbed: a fake
 * receipt is a claim that a family paid.
 *
 * Debtors is a derived list rather than a table — who owes what, from invoices
 * against payments — so it stays empty for as long as both of those do.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

/* -- Definitions: what the school charges ---------------------------------- */

router.get(
  '/fee-items',
  authorise('finance.read', 'fee.manage'),
  validate(fetchFeeItemsSchema),
  FeeItemsController.fetchAll,
);

router.post(
  '/fee-items',
  authorise('fee.manage'),
  validate(createFeeItemSchema),
  FeeItemsController.create,
);

router.patch(
  '/fee-items/:id',
  authorise('fee.manage'),
  validate(updateFeeItemSchema),
  FeeItemsController.update,
);

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
