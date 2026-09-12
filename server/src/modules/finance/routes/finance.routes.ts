import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { FeeItemsController } from '../controllers/feeItems.controller';
import { FeeStructuresController } from '../controllers/feeStructures.controller';
import { DiscountsController } from '../controllers/discounts.controller';
import { InvoicesController } from '../controllers/invoices.controller';
import { PaymentsController } from '../controllers/payments.controller';
import {
  createFeeItemSchema,
  fetchFeeItemsSchema,
  updateFeeItemSchema,
} from '../validators/feeItems.schema';
import {
  createFeeStructureSchema,
  fetchFeeStructuresSchema,
  generateInvoicesSchema,
  updateFeeStructureSchema,
} from '../validators/feeStructures.schema';
import { createDiscountSchema, updateDiscountSchema } from '../validators/discounts.schema';
import {
  cancelInvoiceSchema,
  createInvoiceSchema,
  fetchDebtorsSchema,
  fetchInvoicesSchema,
  invoiceParamSchema,
  studentLedgerParamSchema,
} from '../validators/invoices.schema';
import {
  createPaymentAccountSchema,
  fetchPaymentsSchema,
  receiptParamSchema,
  reconcilePaymentSchema,
  recordPaymentSchema,
  studentIdParamSchema,
} from '../validators/payments.schema';

/**
 * The finance screens, end to end.
 *
 * The module divides into two halves that must not be confused. Fee items,
 * structures and discounts are *definitions* — what the school charges, and
 * what it might waive. Invoices, payments and allocations are *the ledger* —
 * what a family owes and what actually arrived. Nothing in the first half
 * moves money, and nothing in the second is a hypothesis.
 *
 * Every read here is `finance.read`, and every read that touches one family is
 * narrowed further by `visibleStudentIds` in the service: a parent holds
 * `finance.read` for their own children, and the permission alone would show
 * them the school's whole debtors list.
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
  validate(fetchFeeStructuresSchema),
  FeeStructuresController.fetchAll,
);

router.post(
  '/fee-structures',
  authorise('fee.manage'),
  validate(createFeeStructureSchema),
  FeeStructuresController.create,
);

router.patch(
  '/fee-structures/:id',
  authorise('fee.manage'),
  validate(updateFeeStructureSchema),
  FeeStructuresController.update,
);

/**
 * Billing a whole cohort in one action — `invoice.manage`, not `fee.manage`,
 * because this is the moment definitions become claims against families.
 */
router.post(
  '/fee-structures/:id/generate',
  authorise('invoice.manage'),
  validate(generateInvoicesSchema),
  FeeStructuresController.generate,
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

router.get(
  '/invoices',
  authorise('finance.read'),
  validate(fetchInvoicesSchema),
  InvoicesController.fetchAll,
);

router.post(
  '/invoices',
  authorise('invoice.manage'),
  validate(createInvoiceSchema),
  InvoicesController.create,
);

router.get(
  '/invoices/:id',
  authorise('finance.read'),
  validate(invoiceParamSchema),
  InvoicesController.fetchOne,
);

/** Cancelling, not deleting: the row survives with a reason on it. */
router.post(
  '/invoices/:id/cancel',
  authorise('invoice.manage'),
  validate(cancelInvoiceSchema),
  InvoicesController.cancel,
);

router.get(
  '/payments',
  authorise('finance.read', 'payment.manage'),
  validate(fetchPaymentsSchema),
  PaymentsController.fetchAll,
);

/**
 * Money taken at the desk. Online credits never come through here — those are
 * written by the webhook in `publicPayments.routes.ts` after Raven's own API
 * has confirmed them, because a browser proves nothing (spec section 27).
 */
router.post(
  '/payments',
  authorise('payment.manage'),
  validate(recordPaymentSchema),
  PaymentsController.record,
);

/**
 * A bank account number, from Raven, for one student to pay one amount into.
 *
 * Registered before `/payments/:id/*` on purpose: Express matches in order,
 * and `accounts` would otherwise be read as a payment id.
 */
router.post(
  '/payments/accounts',
  authorise('payment.manage'),
  validate(createPaymentAccountSchema),
  PaymentsController.createAccount,
);

router.post(
  '/payments/:id/reconcile',
  authorise('payment.reconcile'),
  validate(reconcilePaymentSchema),
  PaymentsController.reconcile,
);

router.get(
  '/receipts/:paymentId',
  authorise('finance.read', 'payment.manage'),
  validate(receiptParamSchema),
  PaymentsController.receipt,
);

router.get(
  '/students/:id/payment-accounts',
  authorise('finance.read', 'payment.manage'),
  validate(studentIdParamSchema),
  PaymentsController.accountsForStudent,
);

/** One family's statement. A parent may read their own children's and no others'. */
router.get(
  '/students/:id/ledger',
  authorise('finance.read'),
  validate(studentLedgerParamSchema),
  InvoicesController.ledger,
);

router.get(
  '/debtors',
  authorise('finance.read'),
  validate(fetchDebtorsSchema),
  InvoicesController.debtors,
);

export default router;
