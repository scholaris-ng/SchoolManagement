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
}
