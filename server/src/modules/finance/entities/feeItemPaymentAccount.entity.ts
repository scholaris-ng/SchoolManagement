import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { FeeItem } from './feeItem.entity';

/**
 * One bank account a fee item can be paid into.
 *
 * A fee item names a charge, not a single place to pay it — a school that
 * splits tuition between its main account and a capital-development account,
 * or lets a family pay PTA dues into the PTA's own, needs more than one of
 * these per item. Which ones actually apply to a bill is decided per fee
 * structure (`FeeStructureLine.accountIds`), not fixed here: the same item
 * can be billed under just the main account in one term's structure and
 * both accounts in another's.
 */
@Entity('fee_item_payment_accounts')
@Index(['schoolId'])
@Index(['feeItemId'])
export class FeeItemPaymentAccount extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'fee_item_id', type: 'uuid' })
  feeItemId: string;

  @ManyToOne(() => FeeItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fee_item_id' })
  feeItem?: FeeItem;

  /** A nickname to tell accounts apart when choosing one for a structure — "Main account", "PTA account". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 80 })
  bankName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ name: 'account_name', type: 'varchar', length: 160 })
  accountName: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
