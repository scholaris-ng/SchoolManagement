import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { emptyPage, placeholderListSchema } from '../../../shared/placeholder/unbuiltModule';
import { FeeItemsController } from '../controllers/feeItems.controller';
import { DiscountsController } from '../controllers/discounts.controller';
import { PaymentsController } from '../controllers/payments.controller';
import {
  createFeeItemSchema,
  fetchFeeItemsSchema,
  updateFeeItemSchema,
} from '../validators/feeItems.schema';
import { createDiscountSchema, updateDiscountSchema } from '../validators/discounts.schema';
import {
  createPaymentAccountSchema,
  fetchPaymentsSchema,
  studentIdParamSchema,
} from '../validators/payments.schema';

/**
 * The finance screens. Fee items, discounts and payments are real; invoices
 * and structures are not yet.
 *
 * A fee item and a discount are both definitions — what the school charges
 * for, and what it might waive — so neither is money that has moved. Payments
 * are money that has: each row is a credit Raven confirmed, or (later) cash a
 * member of staff took at the desk. Invoices — what a family *owes* — still
 * have no table, so a payment is recorded against a student rather than
 * allocated against a bill; the allocation comes when invoices do.
 *
 * Raising an invoice is the one write still not here, and it is not stubbed:
 * a fake invoice is a claim that a family owes.
 *
 * Debtors is a derived list — who owes what, from invoices against payments —
 * so it stays empty for as long as invoices do.
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
  DiscountsController.fetchAll,
);

router.post(
  '/discounts',
  authorise('discount.manage'),
  validate(createDiscountSchema),
  DiscountsController.create,
);

router.patch(
  '/discounts/:id',
  authorise('discount.manage'),
  validate(updateDiscountSchema),
  DiscountsController.update,
);

/* -- The ledger: what is owed and what arrived ----------------------------- */

router.get('/invoices', authorise('finance.read'), validate(placeholderListSchema), emptyPage);

router.get(
  '/payments',
  authorise('finance.read', 'payment.manage'),
  validate(fetchPaymentsSchema),
  PaymentsController.fetchAll,
);

/**
 * A bank account number, from Raven, for one student to pay one amount into.
 * The credit that later lands on it arrives through the public webhook — see
 * `publicPayments.routes.ts` — never through anything a browser posts.
 */
router.post(
  '/payments/accounts',
  authorise('payment.manage'),
  validate(createPaymentAccountSchema),
  PaymentsController.createAccount,
);

router.get(
  '/students/:id/payment-accounts',
  authorise('finance.read', 'payment.manage'),
  validate(studentIdParamSchema),
  PaymentsController.accountsForStudent,
);

router.get('/debtors', authorise('finance.read'), validate(placeholderListSchema), emptyPage);

export default router;
