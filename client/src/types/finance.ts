export interface FeeItem {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string | null;
  amount: number;
  category: 'TUITION' | 'TRANSPORT' | 'BOARDING' | 'UNIFORM' | 'EXAM' | 'DEVELOPMENT' | 'OTHER';
  /** Optional charges (bus, boarding) are billed only to families who take them. */
  isOptional: boolean;
  isRecurring: boolean;
  isActive: boolean;
  /** Where families pay this charge into. All three are set together, or none. */
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}

export interface FeeStructureLine {
  id: string;
  feeItemId: string;
  feeItemName: string;
  amount: number;
  isOptional: boolean;
  /** The fee item's own payment account, for the printable schedule. */
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  name: string;
  sessionId: string;
  sessionName: string;
  termId?: string | null;
  termName?: string | null;
  levelIds: string[];
  levelNames: string[];
  classIds: string[];
  lines: FeeStructureLine[];
  mandatoryTotal: number;
  optionalTotal: number;
  isActive: boolean;
  version: number;
  /** Letterhead details for the printable fee schedule — set only by `fetchFeeStructure`. */
  schoolName?: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
}

/**
 * What one bulk-billing run did. `skipped` is not an error: it counts the
 * pupils this structure had already billed for the term, which is what makes
 * pressing the button twice safe.
 */
export interface GenerateInvoicesResult {
  created: number;
  skipped: number;
  invoiceIds: string[];
}

export type DiscountType = 'SIBLING' | 'STAFF_CHILD' | 'SCHOLARSHIP' | 'EARLY_PAYMENT' | 'OTHER';

export interface Discount {
  id: string;
  schoolId: string;
  name: string;
  type: DiscountType;
  mode: 'PERCENTAGE' | 'FIXED';
  value: number;
  appliesToFeeItemIds: string[];
  isActive: boolean;
  description?: string | null;
}

export interface StudentDiscount {
  id: string;
  studentId: string;
  studentName: string;
  discountId: string;
  discountName: string;
  type: DiscountType;
  mode: 'PERCENTAGE' | 'FIXED';
  value: number;
  sessionId?: string | null;
  termId?: string | null;
  grantedByName: string;
  grantedAt: string;
  note?: string | null;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PART_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceLine {
  id: string;
  feeItemId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  discountAmount: number;
  lineTotal: number;
  isOptional: boolean;
  /** Where to pay this charge, as it stood when the invoice was raised. */
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}

export interface Invoice {
  id: string;
  schoolId: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  sessionId: string;
  sessionName: string;
  termId: string;
  termName: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  /** Unpaid balance carried in from a previous term (spec section 26). */
  broughtForward: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  note?: string | null;
  createdAt: string;
  version: number;
  /** The school's own letterhead details, for the printed copy. */
  schoolName: string;
  schoolLogoUrl: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
}

/**
 * A bank account number a family transfers school fees into, issued by a
 * provider (Raven) for one student and one amount. Whatever lands on it is
 * recorded as a `Payment` against that student automatically.
 */
export interface PaymentAccount {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  provider: 'RAVEN';
  accountNumber: string;
  accountName: string;
  bankName: string;
  amount: number;
  amountPaid: number;
  isPermanent: boolean;
  status: 'ACTIVE' | 'PAID' | 'CLOSED';
  note?: string | null;
  createdAt: string;
  /**
   * The bill this account was raised for, when it was raised for one. A credit
   * landing on a tied account settles that invoice on its own.
   */
  invoiceId?: string | null;
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'CHEQUE';
export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';

export interface PaymentAllocation {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
}

export interface Payment {
  id: string;
  schoolId: string;
  reference: string;
  providerReference?: string | null;
  studentId: string;
  studentName: string;
  admissionNo: string;
  guardianName?: string | null;
  amount: number;
  method: PaymentMethod;
  provider?: 'RAVEN' | 'PAYSTACK' | 'FLUTTERWAVE' | 'MANUAL' | null;
  status: PaymentStatus;
  paidAt: string;
  recordedByName?: string | null;
  allocations: PaymentAllocation[];
  unallocatedAmount: number;
  isReconciled: boolean;
  receiptNo?: string | null;
  note?: string | null;
}

/** Balances are derived from the ledger, never stored as a single mutable field. */
export interface StudentLedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'DISCOUNT' | 'ADJUSTMENT' | 'CREDIT';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface StudentFinanceSummary {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  totalBilled: number;
  totalPaid: number;
  totalDiscount: number;
  balance: number;
  lastPaymentAt?: string | null;
  overdueInvoices: number;
}

export interface FinanceOverview {
  currency: string;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalDiscount: number;
  collectionRate: number;
  debtorCount: number;
  unreconciledCount: number;
  unreconciledAmount: number;
  collectionTrend: { label: string; billed: number; collected: number }[];
  byCategory: { category: string; billed: number; collected: number }[];
}

export type PaymentReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * A family's own evidence of a payment made outside the system — a photo of
 * a bank slip or transfer alert — submitted for the office to check. Not a
 * `Payment`: it only becomes one once a member of staff approves it, at
 * which point `paymentId` points at the row it turned into.
 */
export interface PaymentReceiptSubmission {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string | null;
  note?: string | null;
  /** A short-lived link to the uploaded slip — re-fetch the record if it expires. */
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  status: PaymentReceiptStatus;
  submittedByName: string;
  submittedAt: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  paymentId?: string | null;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  paymentId: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolAddress: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  amount: number;
  amountInWords: string;
  method: PaymentMethod;
  paidAt: string;
  receivedByName: string;
  allocations: { invoiceNo: string; description: string; amount: number }[];
  balanceAfter: number;
  verificationCode: string;
}
