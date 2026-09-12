import type { FeeCategory } from '../entities/feeItem.entity';
import type { DiscountMode, DiscountType } from '../entities/discount.entity';
import type { PaymentAccountStatus, PaymentProvider } from '../entities/paymentAccount.entity';
import type { PaymentMethod, PaymentSource, PaymentStatus } from '../entities/payment.entity';

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
  /** Empty until invoices exist to allocate against. */
  allocations: never[];
  unallocatedAmount: number;
  isReconciled: boolean;
  receiptNo: string | null;
  note: string | null;
}
