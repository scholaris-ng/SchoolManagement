import type { FeeCategory } from '../entities/feeItem.entity';
import type { DiscountMode, DiscountType } from '../entities/discount.entity';
import type { AppliedDiscount } from '../services/discountCalculator';
import type { PaymentAccountStatus, PaymentProvider } from '../entities/paymentAccount.entity';
import type { PaymentMethod, PaymentSource, PaymentStatus } from '../entities/payment.entity';
import type { PaymentReceiptStatus } from '../entities/paymentReceipt.entity';

/**
 * The status the *client* knows about. `OVERDUE` is not a stored state — see
 * `Invoice.status` — but the projections derive it, so the wire type carries
 * it. `DRAFT` is in the client's union and nothing here ever produces one:
 * this server issues an invoice or does not raise it at all.
 */
export type InvoiceStatusDTO = 'DRAFT' | 'ISSUED' | 'PART_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

/** A centrally-managed bank account. Mirrors `PaymentDestination` on the client. */
export interface PaymentDestinationDTO {
  id: string;
  schoolId: string;
  label: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  sortOrder: number;
}

/**
 * More than one saved account describing what looks like the same real bank
 * account — the same bank and account number entered separately more than
 * once, typically because it predates centralising accounts into one list
 * (see `PaymentDestination`). Offered so a bursar can fold them into one.
 */
export interface PaymentDestinationDuplicateGroupDTO {
  bankName: string;
  accountNumber: string;
  destinations: PaymentDestinationDTO[];
}

/** A named alternative to a fee item's own `amount`. Mirrors `FeeItemPriceOption` on the server. */
export interface FeeItemPriceOptionDTO {
  id: string;
  label: string;
  amount: number;
}

/** Mirrors `client/src/types/finance.ts` — the client's copy is the contract. */
export interface FeeItemDTO {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  description: string | null;
  amount: number;
  category: FeeCategory;
  isOptional: boolean;
  isRecurring: boolean;
  isActive: boolean;
  /** Whether a bursar can set a quantity when billing this item by hand. */
  hasQuantity: boolean;
  /** Where families can pay this charge into — a fee item may have more than one, resolved for display. */
  accounts: PaymentDestinationDTO[];
  /** Extra named prices for this same charge, offered alongside `amount` when raising an invoice by hand. */
  priceOptions: FeeItemPriceOptionDTO[];
}

/** Mirrors `Discount` in `client/src/types/finance.ts`. */
export interface DiscountDTO {
  id: string;
  schoolId: string;
  name: string;
  type: DiscountType;
  mode: DiscountMode;
  value: number;
  appliesToFeeItemIds: string[];
  isActive: boolean;
  description: string | null;
}

/** Mirrors `FeeStructureLine` in `client/src/types/finance.ts`. */
export interface FeeStructureLineDTO {
  id: string;
  feeItemId: string;
  feeItemName: string;
  amount: number;
  isOptional: boolean;
  /** Which of the fee item's own accounts this structure selected, resolved for display. */
  accounts: PaymentDestinationDTO[];
}

/** Mirrors `FeeStructure` in `client/src/types/finance.ts`. */
export interface FeeStructureDTO {
  id: string;
  schoolId: string;
  name: string;
  sessionId: string;
  sessionName: string;
  termId: string | null;
  termName: string | null;
  levelIds: string[];
  levelNames: string[];
  classIds: string[];
  lines: FeeStructureLineDTO[];
  /** What every pupil in scope is billed. The figure the office quotes. */
  mandatoryTotal: number;
  optionalTotal: number;
  isActive: boolean;
  version: number;
  /** Letterhead details for the printable fee schedule — set only by `fetchOne`. */
  schoolName?: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
}

/**
 * The standard charges for one pupil's class, for "Add all standard fees" on
 * a hand-raised invoice — the same charges a bulk run would have billed them
 * under, read from whichever fee structure is written for their class and
 * this term. `structureId` is `null` when none is: a school that has not
 * set one up yet for that class needs telling, not a silently empty list.
 *
 * `isOptional` here is the *structure's* own per-line setting, which can
 * disagree with the fee item's own global default — a fee item marked
 * optional school-wide (boarding, say) can still be written as mandatory on
 * one particular structure, for the cohort it is never actually optional
 * for. The full line list is returned, not just the mandatory ones, so a
 * screen can also correct a fee item's own "(optional)" label for whichever
 * of these items it is currently showing, rather than only the add/skip
 * decision.
 */
export interface ResolveFeeStructureResultDTO {
  structureId: string | null;
  structureName: string | null;
  /** `amount` is this structure's own price for the line, which can disagree with the fee item's school-wide default. */
  lines: { feeItemId: string; amount: number; isOptional: boolean }[];
}

/** What one bulk-billing run did. Mirrors `GenerateInvoicesResult` on the client. */
export interface GenerateInvoicesResultDTO {
  created: number;
  /** Already had a live invoice for this structure and term — not an error. */
  skipped: number;
  /** Of `created`, how many carry at least one granted discount. */
  discounted: number;
  invoiceIds: string[];
}

/**
 * A discount granted to one student — mirrors `StudentDiscount` on the
 * client. `sessionId`/`termId` say which bills it reaches; both null means
 * "until revoked".
 */
export interface StudentDiscountDTO {
  id: string;
  studentId: string;
  studentName: string;
  discountId: string;
  discountName: string;
  type: DiscountType;
  mode: DiscountMode;
  value: number;
  appliesToFeeItemIds: string[];
  sessionId: string | null;
  sessionName: string | null;
  termId: string | null;
  termName: string | null;
  grantedByName: string;
  grantedAt: string;
  note: string | null;
}

/**
 * What one bulk-delete request did. A batch is not all-or-nothing: every
 * invoice that was safe to remove is removed, and everything else comes back
 * named with why, so a bursar clearing out ten mistakes does not have the
 * other nine blocked by the one that already has a payment on it.
 */
export interface DeleteInvoicesResultDTO {
  deletedIds: string[];
  skipped: { id: string; invoiceNo: string; reason: string }[];
}

/** A payment account as it stood when an invoice line was raised — a snapshot, no id. */
export interface InvoiceLineAccountDTO {
  label: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/** Mirrors `InvoiceLine` in `client/src/types/finance.ts`. */
export interface InvoiceLineDTO {
  id: string;
  feeItemId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  discountAmount: number;
  lineTotal: number;
  isOptional: boolean;
  /** Where to pay this charge, snapshotted from the selected accounts when it was billed. */
  accounts: InvoiceLineAccountDTO[];
}

/**
 * Mirrors `Invoice` in `client/src/types/finance.ts`.
 *
 * `amountPaid` and `balance` are computed from allocations on every read, and
 * `status` may come back `OVERDUE` even though no row is ever stored that way.
 */
export interface InvoiceDTO {
  id: string;
  schoolId: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  sessionId: string;
  sessionName: string;
  termId: string;
  termName: string;
  issueDate: string;
  dueDate: string;
  /** Empty in list projections — only the detail read pays for the join. */
  lines: InvoiceLineDTO[];
  subtotal: number;
  discountTotal: number;
  /** Which discounts made up `discountTotal`, so a reduced bill always says why. */
  appliedDiscounts: AppliedDiscount[];
  broughtForward: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatusDTO;
  note: string | null;
  createdAt: string;
  version: number;
  /**
   * Whether this invoice can be hard-deleted right now: no payment has ever
   * been allocated against it, and it neither carried a balance forward from
   * an earlier invoice nor had its own balance carried into a later one. The
   * server still enforces this on the delete call itself — this is what lets
   * the screen grey the option out instead of letting someone hit the refusal.
   */
  deletable: boolean;
  /**
   * The school's own letterhead details, for a printed invoice — assembled
   * the same way `fetchReceipt` builds `ReceiptDTO`'s equivalent fields, from
   * the school record rather than a join, since only the single detail read
   * needs them.
   */
  schoolName: string;
  schoolLogoUrl: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
}

/** Mirrors `PaymentAllocation` in `client/src/types/finance.ts`. */
export interface PaymentAllocationDTO {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  /** Which of the invoice's lines this payment is marked as having covered. */
  paidLineIds: string[];
}

/** Mirrors `StudentLedgerEntry` in `client/src/types/finance.ts`. */
export interface StudentLedgerEntryDTO {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'DISCOUNT' | 'ADJUSTMENT' | 'CREDIT';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  /**
   * Whether this row's own invoice can be hard-deleted right now — only
   * meaningful when `type` is `'INVOICE'`; see `Invoice.deletable` for the
   * three conditions. The server still enforces this on the delete call
   * itself; this is only what lets the statement grey the option out.
   */
  deletable: boolean;
  runningBalance: number;
}

/** Mirrors `StudentFinanceSummary` in `client/src/types/finance.ts`. */
export interface StudentFinanceSummaryDTO {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  totalBilled: number;
  totalPaid: number;
  totalDiscount: number;
  balance: number;
  lastPaymentAt: string | null;
  overdueInvoices: number;
}

/** Mirrors `StudentLedgerResult` in `client/src/features/students/students.types.ts`. */
export interface StudentLedgerResultDTO {
  summary: StudentFinanceSummaryDTO;
  entries: StudentLedgerEntryDTO[];
}

/** Mirrors `Receipt` in `client/src/types/finance.ts`. */
export interface ReceiptDTO {
  id: string;
  receiptNo: string;
  paymentId: string;
  studentId: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  schoolAddress: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  amount: number;
  /** "One hundred and eighty-five thousand naira only" — a receipt convention. */
  amountInWords: string;
  method: PaymentMethod;
  paidAt: string;
  receivedByName: string;
  allocations: {
    /** Needed to call `markReceiptItems` against the right invoice. */
    invoiceId: string;
    invoiceNo: string;
    description: string;
    /** What *this payment* put towards the invoice — not the invoice's own total. */
    amount: number;
    /**
     * The invoice's full total. Sent so a receipt for a part-payment can say
     * so: without it, the itemised charges (which add up to this) sit under an
     * amount that is smaller, and read as an arithmetic error.
     */
    invoiceTotal: number;
    /**
     * The invoice's own charges — tuition, boarding, exam and so on — for a
     * receipt's optional itemised view. Whether to show them is the
     * screen's call, not this endpoint's; they are always sent.
     */
    lines: {
      id: string;
      description: string;
      isOptional: boolean;
      amount: number;
      /** Whether the office has marked this line as covered by this payment. */
      paid: boolean;
    }[];
  }[];
  balanceAfter: number;
  verificationCode: string;
  /**
   * A reversed payment's receipt is still readable — the family holds a copy —
   * but it is no longer proof of anything, and the screen has to say so.
   */
  status: PaymentStatus;
  reversalReason: string | null;
}

/** Mirrors `PaymentAccount` in `client/src/types/finance.ts`. */
export interface PaymentAccountDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  provider: PaymentProvider;
  accountNumber: string;
  accountName: string;
  bankName: string;
  amount: number;
  /** What has actually landed against it so far. */
  amountPaid: number;
  isPermanent: boolean;
  status: PaymentAccountStatus;
  note: string | null;
  createdAt: string;
  /** The bill this was raised for, when it was raised for one. */
  invoiceId: string | null;
}

/** Mirrors `Payment` in `client/src/types/finance.ts`. */
export interface PaymentDTO {
  id: string;
  schoolId: string;
  reference: string;
  providerReference: string | null;
  studentId: string | null;
  studentName: string;
  admissionNo: string;
  guardianName: string | null;
  amount: number;
  method: PaymentMethod;
  provider: PaymentSource;
  status: PaymentStatus;
  paidAt: string;
  recordedByName: string | null;
  /** Which bills this credit settled. Empty for money paid on account. */
  allocations: PaymentAllocationDTO[];
  /** What is left of the payment once its allocations are taken off. */
  unallocatedAmount: number;
  isReconciled: boolean;
  receiptNo: string | null;
  note: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

/** Mirrors `PaymentReceiptSubmission` in `client/src/types/finance.ts`. */
export interface PaymentReceiptDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  invoiceId: string | null;
  invoiceNo: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  note: string | null;
  /** Minted fresh on every read — see `signedDownloadUrl`. Never stored. */
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  status: PaymentReceiptStatus;
  submittedByName: string;
  submittedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  paymentId: string | null;
}

/** One charge on a custom bill. Mirrors `CustomBillLine` on the client. */
export interface CustomBillLineDTO {
  description: string;
  /** Per-unit price — the line totals `amount * quantity`. */
  amount: number;
  quantity: number;
}

/**
 * Mirrors `CustomBill` in `client/src/types/finance.ts`.
 *
 * Not an `Invoice` and never becomes one: it has no student, so none of an
 * invoice's ledger machinery — balance, carry-forward, payment allocation —
 * applies to it. It exists purely to be printed or shared.
 */
export interface CustomBillDTO {
  id: string;
  schoolId: string;
  payerName: string;
  lines: CustomBillLineDTO[];
  total: number;
  note: string | null;
  /** Any one of these settles the whole total — alternatives, not a split. Resolved for display. */
  accounts: PaymentDestinationDTO[];
  createdAt: string;
  updatedAt: string;
  /** Letterhead details for the printable copy — set only by `fetchOne`. */
  schoolName?: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
}
