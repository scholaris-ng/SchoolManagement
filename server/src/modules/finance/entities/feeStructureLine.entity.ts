import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { FeeItem } from './feeItem.entity';
import { FeeStructure } from './feeStructure.entity';

/**
 * One charge within a fee structure.
 *
 * The amount is held here rather than read from the fee item, so a school can
 * charge senior secondary a different tuition from primary without defining
 * two items. `isOptional` likewise overrides the item's own flag: boarding is
 * optional in general, but a structure written for the boarding house may
 * treat it as mandatory.
 *
 * A structure is edited by replacing its whole line set, never by patching one
 * row, so nothing here needs a version column of its own — the parent's covers
 * the edit.
 */
@Entity('fee_structure_lines')
@Index(['feeStructureId'])
@Index(['feeStructureId', 'feeItemId'], { unique: true })
export class FeeStructureLine extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'fee_structure_id', type: 'uuid' })
  feeStructureId: string;

  @ManyToOne(() => FeeStructure, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fee_structure_id' })
  feeStructure?: FeeStructure;

  @Column({ name: 'fee_item_id', type: 'uuid' })
  feeItemId: string;

  @ManyToOne(() => FeeItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fee_item_id' })
  feeItem?: FeeItem;

  /** `numeric` reaches the driver as a string; the repository is where it becomes a number. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'is_optional', type: 'boolean', default: false })
  isOptional: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Which of the fee item's accounts (`PaymentDestination`) apply to this
   * particular structure — a school with two accounts on "Tuition" might bill
   * junior secondary against just the main one and senior secondary against
   * both. Empty means none were chosen; ids that no longer resolve (the
   * account was since deleted) are simply skipped when a bill is raised.
   */
  @Column({ name: 'account_ids', type: 'jsonb', default: [] })
  accountIds: string[];
}
