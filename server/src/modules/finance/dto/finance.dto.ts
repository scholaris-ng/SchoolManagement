import type { FeeCategory } from '../entities/feeItem.entity';
import type { DiscountMode, DiscountType } from '../entities/discount.entity';
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

/** Mirrors `client/src/types/finance.ts` — the client's copy is the contract. */
export interface FeeItemDTO {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  description: string | null;
  amount: number;
  category: FeeCategory;
  isOptional: boolean;
  isRecurring: boolean;
  isActive: boolean;
  /** Where families pay this charge into. All three or none. */
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
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
  /** The fee item's own payment account (`FeeItemDTO`), for the printable schedule. */
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
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

/** What one bulk-billing run did. Mirrors `GenerateInvoicesResult` on the client. */
export interface GenerateInvoicesResultDTO {
  created: number;
  /** Already had a live invoice for this structure and term — not an error. */
  skipped: number;
  invoiceIds: string[];
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
  /** Where to pay this charge, snapshotted from the fee item when it was billed. */
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
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
  broughtForward: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatusDTO;
  note: string | null;
  createdAt: string;
  version: number;
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
  allocations: { invoiceNo: string; description: string; amount: number }[];
  balanceAfter: number;
  verificationCode: string;
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
