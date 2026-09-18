import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { singleFileUpload } from '../../../shared/middleware/upload.middleware';
import { FeeItemsController } from '../controllers/feeItems.controller';
import { FeeStructuresController } from '../controllers/feeStructures.controller';
import { DiscountsController } from '../controllers/discounts.controller';
import { InvoicesController } from '../controllers/invoices.controller';
import { PaymentsController } from '../controllers/payments.controller';
import { PaymentReceiptsController } from '../controllers/paymentReceipts.controller';
import { CustomBillsController } from '../controllers/customBills.controller';
import { PaymentDestinationsController } from '../controllers/paymentDestinations.controller';
import {
  bulkDeleteFeeItemsSchema,
  createFeeItemSchema,
  fetchFeeItemsSchema,
  updateFeeItemSchema,
} from '../validators/feeItems.schema';
import {
  createFeeStructureSchema,
  feeStructureParamSchema,
  fetchFeeStructuresSchema,
  generateInvoicesSchema,
  resolveFeeStructureSchema,
  shareFeeStructureWhatsAppSchema,
  updateFeeStructureSchema,
} from '../validators/feeStructures.schema';
import { createDiscountSchema, updateDiscountSchema } from '../validators/discounts.schema';
import {
  bulkDeleteInvoicesSchema,
  cancelInvoiceSchema,
  createInvoiceSchema,
  fetchDebtorsSchema,
  fetchInvoicesSchema,
  invoiceParamSchema,
  sendInvoiceEmailSchema,
  studentLedgerParamSchema,
  updateInvoiceSchema,
} from '../validators/invoices.schema';
import {
  createPaymentAccountSchema,
  fetchPaymentsSchema,
  receiptParamSchema,
  reconcilePaymentSchema,
  recordPaymentSchema,
  sendReceiptEmailSchema,
  shareReceiptWhatsAppSchema,
  studentIdParamSchema,
} from '../validators/payments.schema';
import {
  approvePaymentReceiptSchema,
  fetchPaymentReceiptsSchema,
  rejectPaymentReceiptSchema,
  RECEIPT_FILE_MAX_BYTES,
  RECEIPT_FILE_MIME_TYPES,
  submitPaymentReceiptSchema,
} from '../validators/paymentReceipts.schema';
import {
  createCustomBillSchema,
  customBillParamSchema,
  fetchCustomBillsSchema,
  updateCustomBillSchema,
} from '../validators/customBills.schema';
import {
  createPaymentDestinationSchema,
  mergePaymentDestinationsSchema,
  paymentDestinationParamSchema,
  updatePaymentDestinationSchema,
} from '../validators/paymentDestinations.schema';

/**
 * The finance screens, end to end.
 *
 * The module divides into two halves that must not be confused. Fee items,
 * structures and discounts are *definitions* — what the school charges, and
 * what it might waive. Invoices, payments and allocations are *the ledger* —
 * what a family owes and what actually arrived. Nothing in the first half
 * moves money, and nothing in the second is a hypothesis.
 *
 * Most reads here are `finance.read`, and every one that touches one family is
 * narrowed further by `visibleStudentIds` in the service, so a parent holds
 * `finance.read` for their own children and nothing wider. The debtors list is
 * the exception: even scoped to one family it is a bursar's screen, not a
 * parent's, so it needs `analytics.read` instead — the same gate as the
 * whole-school finance overview it sits alongside on the client.
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

/**
 * A soft delete — one id or a hundred. `POST`, not `DELETE`, because a
 * `DELETE` request carrying a JSON body is a fight with every layer between
 * the browser and here that a plain `POST` avoids entirely.
 */
router.post(
  '/fee-items/bulk-delete',
  authorise('fee.manage'),
  validate(bulkDeleteFeeItemsSchema),
  FeeItemsController.removeMany,
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

/**
 * "Add all standard fees" on a hand-raised invoice, resolved from whichever
 * structure is written for the chosen student's class this term —
 * `invoice.manage`, the permission that screen itself requires. Registered
 * ahead of `/fee-structures/:id` so Express does not read "resolve" as a
 * structure id.
 */
router.get(
  '/fee-structures/resolve',
  authorise('invoice.manage'),
  validate(resolveFeeStructureSchema),
  FeeStructuresController.resolve,
);

/** One structure — the printable fee schedule reads this directly by id. */
router.get(
  '/fee-structures/:id',
  authorise('finance.read', 'fee.manage'),
  validate(feeStructureParamSchema),
  FeeStructuresController.fetchOne,
);

router.patch(
  '/fee-structures/:id',
  authorise('fee.manage'),
  validate(updateFeeStructureSchema),
  FeeStructuresController.update,
);

/** Refused once the structure has actually billed anyone — see the service. */
router.delete(
  '/fee-structures/:id',
  authorise('fee.manage'),
  validate(feeStructureParamSchema),
  FeeStructuresController.remove,
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

/**
 * Stores the fee schedule as a PDF and returns a WhatsApp message linking to
 * it — see `FeeStructuresService.shareOnWhatsApp`. Anyone who may print the
 * schedule from the fee screens may share it; the link is public, so this is
 * deliberately not open to `finance.read`, which a parent holds.
 */
router.post(
  '/fee-structures/:id/whatsapp',
  authorise('fee.manage', 'invoice.manage'),
  validate(shareFeeStructureWhatsAppSchema),
  FeeStructuresController.shareWhatsApp,
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

/**
 * The school's own bank accounts, managed once in one place and picked by id
 * from a fee item, a fee structure line, or a custom bill — see
 * `PaymentDestination`. Readable under either `fee.manage` or `invoice.manage`
 * since both a fee item dialog and a custom bill dialog need this list to
 * offer a choice from; only `fee.manage` may change the accounts themselves.
 */
router.get(
  '/payment-destinations',
  authorise('finance.read', 'fee.manage', 'invoice.manage'),
  PaymentDestinationsController.fetchAll,
);

/**
 * Groups of saved accounts that share a bank and account number — almost
 * always the same real account entered more than once before accounts were
 * centralised. Registered ahead of nothing that would collide: there is no
 * `GET /payment-destinations/:id`, only the list above.
 */
router.get(
  '/payment-destinations/duplicates',
  authorise('fee.manage'),
  PaymentDestinationsController.fetchDuplicates,
);

router.post(
  '/payment-destinations',
  authorise('fee.manage'),
  validate(createPaymentDestinationSchema),
  PaymentDestinationsController.create,
);

/** Folds a group of duplicates into one survivor — see `PaymentDestinationRepository.merge`. */
router.post(
  '/payment-destinations/merge',
  authorise('fee.manage'),
  validate(mergePaymentDestinationsSchema),
  PaymentDestinationsController.merge,
);

router.patch(
  '/payment-destinations/:id',
  authorise('fee.manage'),
  validate(updatePaymentDestinationSchema),
  PaymentDestinationsController.update,
);

router.delete(
  '/payment-destinations/:id',
  authorise('fee.manage'),
  validate(paymentDestinationParamSchema),
  PaymentDestinationsController.remove,
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

/**
 * Hard delete, but only where it is safe — see `Invoice.deletable` and
 * `InvoicesService.deleteInvoices`. `POST`, not `DELETE`, for the same reason
 * `/fee-items/bulk-delete` is: a `DELETE` carrying a JSON body fights every
 * layer between the browser and here. Registered ahead of `/invoices/:id` so
 * Express does not read "bulk-delete" as an invoice id.
 */
router.post(
  '/invoices/bulk-delete',
  authorise('invoice.manage'),
  validate(bulkDeleteInvoicesSchema),
  InvoicesController.deleteMany,
);

router.get(
  '/invoices/:id',
  authorise('finance.read'),
  validate(invoiceParamSchema),
  InvoicesController.fetchOne,
);

/**
 * The student and term are fixed once issued; only the due date, the note,
 * and — while nothing has been paid — the charges themselves can change.
 */
router.patch(
  '/invoices/:id',
  authorise('invoice.manage'),
  validate(updateInvoiceSchema),
  InvoicesController.update,
);

/** Cancelling, not deleting: the row survives with a reason on it. */
router.post(
  '/invoices/:id/cancel',
  authorise('invoice.manage'),
  validate(cancelInvoiceSchema),
  InvoicesController.cancel,
);

/**
 * Emails one invoice to a guardian already linked to its student — see
 * `InvoicesService.emailInvoice`. `invoice.manage`, same as raising the bill
 * itself.
 */
router.post(
  '/invoices/:id/email',
  authorise('invoice.manage'),
  validate(sendInvoiceEmailSchema),
  InvoicesController.sendEmail,
);

/**
 * Stores one invoice as a PDF and returns a WhatsApp message linking to it —
 * see `InvoicesService.shareInvoiceOnWhatsApp`. `invoice.manage`, same as
 * emailing it: the link is public, so it is not open to `finance.read`.
 */
router.post(
  '/invoices/:id/whatsapp',
  authorise('invoice.manage'),
  validate(invoiceParamSchema),
  InvoicesController.shareWhatsApp,
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

router.post(
  '/receipts/:paymentId/email',
  authorise('payment.manage', 'invoice.manage'),
  validate(sendReceiptEmailSchema),
  PaymentsController.sendReceiptEmail,
);

router.post(
  '/receipts/:paymentId/whatsapp',
  authorise('payment.manage', 'invoice.manage'),
  validate(shareReceiptWhatsAppSchema),
  PaymentsController.shareReceiptWhatsApp,
);

router.get(
  '/students/:id/payment-accounts',
  authorise('finance.read', 'payment.manage'),
  validate(studentIdParamSchema),
  PaymentsController.accountsForStudent,
);

/**
 * A family's own photograph of a bank slip, submitted for the office to
 * judge — see `PaymentReceiptsService`. `finance.read` is enough to submit
 * one: a parent already holds it for their own children, scoped by
 * `StudentAccessService` inside the service the same way `fetchPayments` is.
 * Reviewing one, in contrast, is `payment.manage` — only the office turns a
 * claim into a ledgered payment.
 */
router.post(
  '/payment-receipts',
  authorise('finance.read'),
  singleFileUpload('file', RECEIPT_FILE_MIME_TYPES, RECEIPT_FILE_MAX_BYTES),
  validate(submitPaymentReceiptSchema),
  PaymentReceiptsController.submit,
);

router.get(
  '/payment-receipts',
  authorise('payment.manage'),
  validate(fetchPaymentReceiptsSchema),
  PaymentReceiptsController.fetchAll,
);

router.post(
  '/payment-receipts/:id/approve',
  authorise('payment.manage'),
  validate(approvePaymentReceiptSchema),
  PaymentReceiptsController.approve,
);

router.post(
  '/payment-receipts/:id/reject',
  authorise('payment.manage'),
  validate(rejectPaymentReceiptSchema),
  PaymentReceiptsController.reject,
);

router.get(
  '/students/:id/payment-receipts',
  authorise('finance.read'),
  validate(studentIdParamSchema),
  PaymentReceiptsController.fetchForStudent,
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
  authorise('analytics.read'),
  validate(fetchDebtorsSchema),
  InvoicesController.debtors,
);

/**
 * One-off bills outside the real ledger — a contractor, a visitor, a charge
 * with no enrolled student behind it. `invoice.manage` throughout, not
 * `finance.read`: unlike a real invoice this is never one family's own
 * record to see, so there is no parent-facing reason to expose it.
 */
router.get(
  '/custom-bills',
  authorise('invoice.manage'),
  validate(fetchCustomBillsSchema),
  CustomBillsController.fetchAll,
);

router.post(
  '/custom-bills',
  authorise('invoice.manage'),
  validate(createCustomBillSchema),
  CustomBillsController.create,
);

router.get(
  '/custom-bills/:id',
  authorise('invoice.manage'),
  validate(customBillParamSchema),
  CustomBillsController.fetchOne,
);

router.patch(
  '/custom-bills/:id',
  authorise('invoice.manage'),
  validate(updateCustomBillSchema),
  CustomBillsController.update,
);

router.post(
  '/custom-bills/:id/whatsapp',
  authorise('invoice.manage'),
  validate(customBillParamSchema),
  CustomBillsController.shareWhatsApp,
);

router.delete(
  '/custom-bills/:id',
  authorise('invoice.manage'),
  validate(customBillParamSchema),
  CustomBillsController.remove,
);

export default router;
