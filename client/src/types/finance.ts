/**
 * A bank account the school gets paid into, managed once in one central
 * place. A fee item, a fee structure line, and a custom bill each pick from
 * this list by id rather than owning their own copy of the details — edit an
 * account here and it changes everywhere it is picked. An issued invoice is
 * unaffected either way: `InvoiceLineAccount` snapshots the details it was
 * raised under.
 */
export interface PaymentDestination {
  id: string;
  schoolId: string;
  label?: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  sortOrder: number;
}

/**
 * More than one saved account describing what looks like the same real bank
 * account — the same bank and account number entered separately more than
 * once, typically because it predates centralising accounts into one list.
 * Offered so a bursar can fold the group into one.
 */
export interface PaymentDestinationDuplicateGroup {
  bankName: string;
  accountNumber: string;
  destinations: PaymentDestination[];
}

/** A named alternative to a fee item's own `amount` — "Zone A" transport at one price, "Zone B" at another. */
export interface FeeItemPriceOption {
  id: string;
  label: string;
  amount: number;
}

export interface FeeItem {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  description?: string | null;
  amount: number;
  category: 'TUITION' | 'TRANSPORT' | 'BOARDING' | 'UNIFORM' | 'EXAM' | 'DEVELOPMENT' | 'OTHER';
  /** Optional charges (bus, boarding) are billed only to families who take them. */
  isOptional: boolean;
  isRecurring: boolean;
  isActive: boolean;
  /** Lets a bursar set a quantity when billing this item by hand — a locker, a textbook, a bus trip. */
  hasQuantity: boolean;
  /** Where families can pay this charge into, resolved for display. */
  accounts: PaymentDestination[];
  /** Extra named prices for this same charge, offered alongside `amount` when raising an invoice by hand. */
  priceOptions: FeeItemPriceOption[];
}

export interface FeeStructureLine {
  id: string;
  feeItemId: string;
  feeItemName: string;
  amount: number;
  isOptional: boolean;
  /** Which of the fee item's own accounts this structure selected, resolved for display. */
  accounts: PaymentDestination[];
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
 * The standard charges for one pupil's class, for "Add all standard fees" on
 * a hand-raised invoice. `structureId` is `null` when the school has not set
 * one up yet for that class and term — worth saying plainly rather than
 * quietly adding nothing.
 *
 * `isOptional` is the structure's own per-line setting, which can disagree
 * with a fee item's global default (boarding, say, marked optional
 * school-wide but written as mandatory on the one structure it is never
 * actually optional under) — the full line list lets a screen correct that
 * item's own "(optional)" label rather than only the add/skip decision.
 */
export interface ResolveFeeStructureResult {
  structureId: string | null;
  structureName: string | null;
  /** `amount` is this structure's own price for the line, which can disagree with the fee item's school-wide default. */
  lines: { feeItemId: string; amount: number; isOptional: boolean }[];
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
  accounts: InvoiceLineAccount[];
}

/** A payment account as it stood when an invoice line was raised — a snapshot, no id. */
export interface InvoiceLineAccount {
  label?: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
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
  /**
   * Whether this invoice can be hard-deleted right now — no payment ever
   * landed on it, and it neither absorbed an earlier invoice's balance nor
   * had its own carried into a later one. The server still enforces this on
   * the delete call itself; this is only what lets the screen grey it out.
   */
  deletable: boolean;
  /** The school's own letterhead details, for the printed copy. */
  schoolName: string;
  schoolLogoUrl: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
}

/** One charge on a custom bill. `amount` is the per-unit price; the line totals `amount * quantity`. */
export interface CustomBillLine {
  description: string;
  amount: number;
  quantity: number;
}

/**
 * A one-off bill for whoever a school needs to invoice outside its own
 * enrolled students — a contractor, a visitor, a single charge with no real
 * student behind it. Never an `Invoice`: it carries no balance, no ledger
 * entry, nothing a payment can be allocated against. It exists purely to be
 * printed or shared.
 */
export interface CustomBill {
  id: string;
  schoolId: string;
  payerName: string;
  lines: CustomBillLine[];
  total: number;
  note?: string | null;
  /** Any one of these settles the whole total — alternatives, not a split. Resolved for display. */
  accounts: PaymentDestination[];
  createdAt: string;
  updatedAt: string;
  /** Letterhead details for the printable copy — set only by `fetchCustomBill`. */
  schoolName?: string;
  schoolLogoUrl?: string | null;
  schoolPhone?: string;
  schoolEmail?: string;
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
  /** Only meaningful when `type` is `'INVOICE'` — see `Invoice.deletable`. */
  deletable: boolean;
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
  studentId: string;
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
  allocations: {
    invoiceNo: string;
    description: string;
    /** What this payment put towards the invoice — not the invoice's own total. */
    amount: number;
    /** The invoice's full total, so a part-payment can be shown as one. */
    invoiceTotal: number;
    /** The invoice's own charges, for the receipt's optional itemised view. */
    lines: { description: string; isOptional: boolean; amount: number }[];
  }[];
  balanceAfter: number;
  verificationCode: string;
}

/**
 * What opening WhatsApp needs once a finance document has been stored: a link
 * to it, the message to type around that link, and who it goes to when the
 * server could work that out. Mirrors `WhatsAppShare` in
 * `server/src/shared/services/whatsappShare.service.ts`.
 */
export interface WhatsAppShare {
  fileUrl: string;
  message: string;
  /** International digits for `wa.me`; `null` means the sender picks the chat. */
  phone: string | null;
  /** Why there is no `phone` when there should have been one — for the sender to be told. */
  notice: string | null;
}
