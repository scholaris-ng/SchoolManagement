import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

export type DiscountType = 'SIBLING' | 'STAFF_CHILD' | 'SCHOLARSHIP' | 'EARLY_PAYMENT' | 'OTHER';

export const DISCOUNT_TYPES: readonly DiscountType[] = [
  'SIBLING',
  'STAFF_CHILD',
  'SCHOLARSHIP',
  'EARLY_PAYMENT',
  'OTHER',
];

export type DiscountMode = 'PERCENTAGE' | 'FIXED';

export const DISCOUNT_MODES: readonly DiscountMode[] = ['PERCENTAGE', 'FIXED'];

/**
 * A waiver a school may apply against a family's fees — a scholarship, a
 * sibling reduction, a staff-child concession (spec section 26).
 *
 * Like a fee item, a discount is a definition, not money that has moved: it
 * says what *could* be waived, not that anything was. Applying one to an
 * actual invoice line is a ledger concern and waits on that table existing.
 */
@Entity('discounts')
@Index(['schoolId'])
@Index(['schoolId', 'isActive'])
export class Discount extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: DiscountType;

  @Column({ type: 'varchar', length: 10 })
  mode: DiscountMode;

  /**
   * A percentage (0-100) under `PERCENTAGE` mode, or a currency amount under
   * `FIXED` — `numeric(12,2)` either way, for the same reason `FeeItem.amount`
   * is: Postgres hands `numeric` back as a string, so the repository is the
   * one place that converts.
   */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  value: string;

  /** Fee items this waiver can be applied against. Empty means "any". */
  @Column({ name: 'applies_to_fee_item_ids', type: 'jsonb', default: [] })
  appliesToFeeItemIds: string[];

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
