import type { FeeCategory } from '../entities/feeItem.entity';

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
