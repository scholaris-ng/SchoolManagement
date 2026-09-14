import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { FeeItem, type FeeCategory } from './feeItem.entity';
import { Invoice } from './invoice.entity';

/**
 * One charge on an issued invoice — a snapshot, not a reference.
 *
 * The description, category and amount are copied from the fee item at the
 * moment the bill is raised. That is the whole point: when the school puts
 * tuition up next session, the invoice a parent is holding must still say what
 * it said when they were sent it (spec section 26). The `feeItemId` survives
 * only so reporting can group by item, never so a read can go and fetch a
 * current amount.
 *
 * `category` is copied for the same reason and one more: the overview's
 * per-category breakdown becomes a query over these lines alone, with no join
 * back to a table whose rows may since have been recategorised.
 */
@Entity('invoice_lines')
@Index(['invoiceId'])
@Index(['schoolId', 'category'])
export class InvoiceLine extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @Column({ name: 'fee_item_id', type: 'uuid' })
  feeItemId: string;

  @ManyToOne(() => FeeItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fee_item_id' })
  feeItem?: FeeItem;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  category: FeeCategory;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_amount', type: 'numeric', precision: 12, scale: 2 })
  unitAmount: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  /** `quantity × unitAmount − discountAmount`, stored so a total is one read. */
  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: string;

  @Column({ name: 'is_optional', type: 'boolean', default: false })
  isOptional: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Where to pay this particular charge — copied from whichever of the fee
   * item's accounts the structure selected (`FeeStructureLine.accountIds`),
   * at the moment this line is raised, for the same reason `description` and
   * `unitAmount` are copied rather than referenced: the school changing or
   * deleting an account next term must not rewrite where a bill already sent
   * says the money goes. A snapshot, not a foreign key — that is also why it
   * carries no id of its own, only what a family reading the bill needs.
   */
  @Column({ type: 'jsonb', default: [] })
  accounts: InvoiceLineAccountSnapshot[];
}

export interface InvoiceLineAccountSnapshot {
  label: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
}
