import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

export type FeeCategory =
  | 'TUITION'
  | 'TRANSPORT'
  | 'BOARDING'
  | 'UNIFORM'
  | 'EXAM'
  | 'DEVELOPMENT'
  | 'OTHER';

export const FEE_CATEGORIES: readonly FeeCategory[] = [
  'TUITION',
  'TRANSPORT',
  'BOARDING',
  'UNIFORM',
  'EXAM',
  'DEVELOPMENT',
  'OTHER',
];

/**
 * A single chargeable line a school bills for (spec section 9).
 *
 * Amounts are `numeric(12,2)`: money is never a float, and Postgres hands
 * `numeric` back as a string, so the repository is the one place that converts.
 */
@Entity('fee_items')
@Index(['schoolId', 'code'], { unique: true })
@Index(['schoolId', 'isActive'])
export class FeeItem extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 20 })
  category: FeeCategory;

  @Column({ name: 'is_optional', type: 'boolean', default: false })
  isOptional: boolean;

  @Column({ name: 'is_recurring', type: 'boolean', default: true })
  isRecurring: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Where a family transfers money for this particular charge — a school that
   * routes tuition to its main account and PTA dues to the PTA's own needs
   * this named per item, not one bank detail for the whole invoice. All three
   * are set together or not at all (`feeItems.schema.ts`). Copied onto
   * `InvoiceLine` at issue time, the same as `amount`, so a bill already sent
   * keeps naming the account it was raised under even if this one later
   * changes.
   */
  @Column({ name: 'bank_name', type: 'varchar', length: 80, nullable: true })
  bankName: string | null;

  @Column({ name: 'account_number', type: 'varchar', length: 20, nullable: true })
  accountNumber: string | null;

  @Column({ name: 'account_name', type: 'varchar', length: 160, nullable: true })
  accountName: string | null;
}
