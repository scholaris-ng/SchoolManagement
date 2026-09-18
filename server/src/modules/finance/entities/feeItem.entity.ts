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
 * A named alternative to a fee item's own `amount` — "Zone A" transport at
 * one price, "Zone B" at another, the same charge either way. A bursar
 * raising a bill by hand picks one of these per invoice line instead of
 * always billing the item's default; a fee structure line still sets its
 * own flat amount regardless, unaffected by any of these.
 */
export interface FeeItemPriceOption {
  id: string;
  label: string;
  amount: number;
}

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

  @Column({ type: 'varchar', length: 20, nullable: true })
  code: string | null;

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
   * Whether this charge can be billed by quantity — a locker, a textbook, a
   * bus trip — rather than always once. Off by default: most charges
   * (tuition, exam fees) have no unit to count, and showing a quantity field
   * for those would just invite a bursar to mistype `1` as something else.
   */
  @Column({ name: 'has_quantity', type: 'boolean', default: false })
  hasQuantity: boolean;

  /**
   * Which of the school's centrally-managed accounts (`PaymentDestination`)
   * families can pay this charge into — an item may point at more than one.
   * Referenced by id rather than owned here, so editing an account once, in
   * one place, updates it everywhere it is picked. `FeeStructureLine.accountIds`
   * is a particular structure narrowing this list further, never widening it.
   */
  @Column({ name: 'payment_destination_ids', type: 'jsonb', default: [] })
  paymentDestinationIds: string[];

  /**
   * Extra named prices a bursar can choose between for this same charge on a
   * hand-raised invoice — `amount` stays the default when none is picked.
   * See `FeeItemPriceOption`.
   */
  @Column({ name: 'price_options', type: 'jsonb', default: [] })
  priceOptions: FeeItemPriceOption[];
}
