import type { FeeCategory } from '../entities/feeItem.entity';
import type { DiscountMode, DiscountType } from '../entities/discount.entity';

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
